'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion'
import {
  Clock3,
  Dumbbell,
  Loader2,
  MessageSquare,
  Pencil,
  Search,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EditProfileForm } from '@/components/edit-profile-form'
import { FindPeopleSheet } from '@/components/find-people-sheet'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ActivityHeatmap } from '@/components/month-heatmap'
import { PersonalRecordsSection } from '@/components/personal-records-section'
import { ProfileAchievements } from '@/components/profile-achievements'
import {
  ProfileSocialSheet,
  type SocialListKind,
} from '@/components/profile-social-sheet'
import { SessionSummaryCard } from '@/components/session-summary-card'
import { SharedSplitCard } from '@/components/shared-split-card'
import { StreakBadge } from '@/components/streak-badge'
import { UserAvatar } from '@/components/user-avatar'
import { CTA_PRIMARY } from '@/lib/accent'
import type { PublicProfileBundle } from '@/lib/data/social'
import type { SessionSummaryData } from '@/lib/data/session-summary'
import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  followUserAction,
  getFollowStatusAction,
  getFriendshipStatusAction,
  getSessionSummaryAction,
  sendFriendRequestAction,
  startDmWithUserAction,
  unfollowUserAction,
  unfriendAction,
} from '@/lib/data/social-actions'
import type { FriendshipRelation } from '@/lib/data/social'
import { formatSessionDate, formatVolume } from '@/lib/session-store'
import {
  ageFromBirthDate,
  formatHeightCm,
  formatWeightKg,
  type WeightUnit,
} from '@/lib/units'

type UnifiedProfileViewProps = {
  data: PublicProfileBundle
  editInitial?: {
    userId: string
    username: string
    displayName: string
    bio: string
    avatarUrl: string | null
  }
  /** Viewer's preferred unit when signed in; falls back to profile owner's. */
  weightUnit?: WeightUnit
  /** When the signed-in viewer is a guest, hide social actions. */
  viewerIsGuest?: boolean
}

export function UnifiedProfileView({
  data,
  editInitial,
  weightUnit: weightUnitProp,
  viewerIsGuest = false,
}: UnifiedProfileViewProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const weightUnit: WeightUnit =
    weightUnitProp ??
    (data.profile.preferred_unit === 'lb' ? 'lb' : 'kg')
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [followerCount, setFollowerCount] = useState(data.followerCount)
  const [isFollowing, setIsFollowing] = useState(data.isFollowing)
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipRelation>(
    data.friendshipStatus ?? (data.isFriend ? 'friends' : 'none'),
  )
  const [followPending, startFollowTransition] = useTransition()
  const [friendPending, startFriendTransition] = useTransition()
  const [messagePending, startMessageTransition] = useTransition()
  const [, startSessionTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [listKind, setListKind] = useState<SocialListKind | null>(null)
  const [friendPulse, setFriendPulse] = useState(false)
  const [followPulse, setFollowPulse] = useState(false)
  const [sessionSummary, setSessionSummary] =
    useState<SessionSummaryData | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const closeSocialSheet = useCallback(() => setListKind(null), [])
  const closeFindSheet = useCallback(() => setFindOpen(false), [])

  // Independent follow + friendship fetches on mount (and when profile changes).
  useEffect(() => {
    setFollowerCount(data.followerCount)
    if (data.isSelf) return

    let cancelled = false
    void getFollowStatusAction(data.profile.id).then((result) => {
      if (!cancelled && !result.error) setIsFollowing(result.isFollowing)
    })
    void getFriendshipStatusAction(data.profile.id).then((result) => {
      if (!cancelled && !result.error) setFriendshipStatus(result.status)
    })
    return () => {
      cancelled = true
    }
  }, [data.isSelf, data.profile.id, data.followerCount])

  const name =
    data.profile.display_name || data.profile.username || tCommon('athlete')
  const handle = data.profile.username
  const isFriend = friendshipStatus === 'friends'
  const anyPending = followPending || friendPending || messagePending

  const toggleFollow = () => {
    setError(null)
    setFollowPulse(true)
    window.setTimeout(() => setFollowPulse(false), 280)
    startFollowTransition(async () => {
      if (isFollowing) {
        const result = await unfollowUserAction(data.profile.id)
        if (!result.ok) {
          setError(result.error ?? t('couldNotUnfollow'))
          return
        }
        setIsFollowing(false)
        setFollowerCount((c) => Math.max(0, c - 1))
        return
      }
      const result = await followUserAction(data.profile.id)
      if (!result.ok) {
        setError(result.error ?? t('couldNotFollow'))
        return
      }
      setIsFollowing(true)
      setFollowerCount((c) => c + 1)
    })
  }

  const handleFriendAction = () => {
    setError(null)
    setFriendPulse(true)
    window.setTimeout(() => setFriendPulse(false), 280)
    startFriendTransition(async () => {
      if (friendshipStatus === 'none') {
        const result = await sendFriendRequestAction(data.profile.id)
        if (!result.ok) {
          setError(result.error ?? t('couldNotSendRequest'))
          return
        }
        setFriendshipStatus(result.status ?? 'outgoing')
        return
      }
      if (friendshipStatus === 'outgoing') {
        const result = await cancelFriendRequestAction(data.profile.id)
        if (!result.ok) {
          setError(result.error ?? t('couldNotCancelRequest'))
          return
        }
        setFriendshipStatus('none')
        return
      }
      if (friendshipStatus === 'incoming') {
        const result = await acceptFriendRequestAction(data.profile.id)
        if (!result.ok) {
          setError(result.error ?? t('couldNotAccept'))
          return
        }
        setFriendshipStatus('friends')
        return
      }
      const confirmed = window.confirm(t('removeFriendConfirm', { name }))
      if (!confirmed) return
      const result = await unfriendAction(data.profile.id)
      if (!result.ok) {
        setError(result.error ?? t('couldNotRemoveFriend'))
        return
      }
      setFriendshipStatus('none')
    })
  }

  const declineIncoming = () => {
    setError(null)
    startFriendTransition(async () => {
      const result = await declineFriendRequestAction(data.profile.id)
      if (!result.ok) {
        setError(result.error ?? t('couldNotDecline'))
        return
      }
      setFriendshipStatus('none')
    })
  }

  const openMessage = () => {
    setError(null)
    startMessageTransition(async () => {
      const result = await startDmWithUserAction(data.profile.id)
      if (!result.ok) {
        setError(result.error ?? t('couldNotStartChat'))
        return
      }
      router.push(`/dashboard/messages/${result.threadId}`)
    })
  }

  const openSession = (sessionId: string) => {
    setSessionSummary(null)
    setSessionError(null)
    setSessionLoading(true)
    startSessionTransition(async () => {
      const result = await getSessionSummaryAction(sessionId)
      setSessionLoading(false)
      if (!result.data) {
        setSessionError(result.error ?? t('couldNotLoadSession'))
        return
      }
      setSessionSummary(result.data)
    })
  }

  const closeSession = () => {
    setSessionSummary(null)
    setSessionError(null)
    setSessionLoading(false)
  }

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: 'easeOut' as const },
        }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
      <section className="is-panel relative mb-8 overflow-hidden p-5 sm:p-8">
        <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 left-0 h-36 w-36 rounded-full bg-heat/8 blur-3xl" aria-hidden="true" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <motion.div {...fadeUp(0)}>
            <UserAvatar
              name={name}
              username={handle}
              avatarUrl={data.profile.avatar_url}
              size="lg"
              link={false}
              className="!size-24 !text-2xl sm:!size-28"
            />
          </motion.div>

          <div className="min-w-0 flex-1">
            <motion.div
              className="flex flex-wrap items-start justify-between gap-3"
              {...fadeUp(0.08)}
            >
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                  {name}
                </h1>
                {handle && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <LtrIsolate>@{handle}</LtrIsolate>
                  </p>
                )}
              </div>
              <StreakBadge
                streakDays={data.streakDays}
                hoursLeft={data.streakHoursLeft}
              />
            </motion.div>

            {data.profile.bio && (
              <motion.p
                className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground"
                {...fadeUp(0.12)}
              >
                {data.profile.bio}
              </motion.p>
            )}

            {(data.profile.height_cm != null ||
              data.profile.current_weight_kg != null ||
              data.profile.birth_date ||
              data.profile.gender) && (
              <motion.div
                className="mt-4 flex flex-wrap gap-2"
                {...fadeUp(0.15)}
              >
                {data.profile.gender && (
                  <span className="rounded-full border border-silver/15 bg-background/50 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                    {data.profile.gender === 'male'
                      ? t('genderMale')
                      : t('genderFemale')}
                  </span>
                )}
                {(() => {
                  const age = ageFromBirthDate(data.profile.birth_date)
                  return age != null ? (
                    <span className="rounded-full border border-silver/15 bg-background/50 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                      {t('ageYears', { age })}
                    </span>
                  ) : null
                })()}
                {data.profile.height_cm != null && (
                  <span className="rounded-full border border-silver/15 bg-background/50 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                    {t('statHeight', {
                      value: formatHeightCm(
                        Number(data.profile.height_cm),
                        weightUnit,
                      ),
                    })}
                  </span>
                )}
                {data.profile.current_weight_kg != null && (
                  <span className="rounded-full border border-silver/15 bg-background/50 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                    {t('statWeight', {
                      value: formatWeightKg(
                        Number(data.profile.current_weight_kg),
                        weightUnit,
                        1,
                      ),
                    })}
                  </span>
                )}
              </motion.div>
            )}

            {!viewerIsGuest && (
            <motion.div
              className="mt-4 flex flex-wrap items-center gap-1"
              {...fadeUp(0.18)}
            >
              <StatButton
                count={followerCount}
                label={t('followers')}
                onClick={() => setListKind('followers')}
              />
              <StatButton
                count={data.followingCount}
                label={t('following')}
                onClick={() => setListKind('following')}
              />
              <StatButton
                count={data.friendCount}
                label={t('friends')}
                accent="green"
                onClick={() => setListKind('friends')}
              />
              <button
                type="button"
                onClick={() => setFindOpen(true)}
                className="ms-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-blue transition hover:bg-blue-tint/40"
              >
                <Search className="size-3.5" />
                {t('findPeople')}
              </button>
            </motion.div>
            )}

            <motion.div className="mt-5 flex flex-wrap gap-2" {...fadeUp(0.24)}>
              {data.isSelf ? (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-bold tracking-[0.14em] transition ${CTA_PRIMARY}`}
                >
                  <Pencil className="size-3.5" />
                  {t('editProfile')}
                </button>
              ) : viewerIsGuest ? null : (
                <>
                  <motion.button
                    type="button"
                    disabled={followPending}
                    onClick={toggleFollow}
                    animate={
                      followPulse && !reduceMotion
                        ? { scale: [1, 0.94, 1.04, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.28 }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-bold tracking-[0.14em] transition disabled:opacity-60 ${
                      isFollowing
                        ? 'border border-silver/25 text-muted-foreground hover:border-destructive/40 hover:text-destructive'
                        : 'border border-silver/25 text-foreground hover:border-gold/40 hover:text-gold'
                    }`}
                  >
                    {followPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isFollowing ? (
                      <UserMinus className="size-3.5" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={isFollowing ? 'following' : 'follow'}
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          reduceMotion ? undefined : { opacity: 0, y: -4 }
                        }
                        transition={{ duration: 0.15 }}
                      >
                        {isFollowing ? t('followingBtn') : t('follow')}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>

                  {friendshipStatus === 'incoming' && (
                    <button
                      type="button"
                      disabled={friendPending}
                      onClick={declineIncoming}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/25 px-5 text-xs font-bold tracking-[0.14em] text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
                    >
                      {t('decline')}
                    </button>
                  )}
                  <motion.button
                    type="button"
                    disabled={friendPending}
                    onClick={handleFriendAction}
                    animate={
                      friendPulse && !reduceMotion
                        ? { scale: [1, 0.94, 1.04, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.28 }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-bold tracking-[0.14em] transition disabled:opacity-60 ${
                      isFriend
                        ? 'border border-success/35 bg-success/10 text-success'
                        : friendshipStatus === 'outgoing'
                          ? 'border border-silver/25 text-muted-foreground hover:border-destructive/40 hover:text-destructive'
                          : CTA_PRIMARY
                    }`}
                  >
                    {friendPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : friendshipStatus === 'outgoing' ? (
                      <UserMinus className="size-3.5" />
                    ) : (
                      <Users className="size-3.5" />
                    )}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={friendshipStatus}
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          reduceMotion ? undefined : { opacity: 0, y: -4 }
                        }
                        transition={{ duration: 0.15 }}
                      >
                        {friendshipStatus === 'friends'
                          ? t('friendsBtn')
                          : friendshipStatus === 'outgoing'
                            ? t('requestSent')
                            : friendshipStatus === 'incoming'
                              ? t('accept')
                              : t('addFriend')}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                  <button
                    type="button"
                    disabled={anyPending}
                    onClick={openMessage}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue/35 bg-blue-tint/50 px-5 text-xs font-bold tracking-[0.14em] text-blue transition hover:border-blue/55 disabled:opacity-60"
                  >
                    <MessageSquare className="size-3.5" />
                    {t('message')}
                  </button>
                </>
              )}
            </motion.div>

            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: t('totalVolume'),
            value: formatVolume(data.analytics.totalVolume, weightUnit),
            icon: Dumbbell,
            tone: 'text-gold',
          },
          {
            label: t('sessions'),
            value: String(data.analytics.totalSessions),
            icon: Clock3,
            tone: 'text-muted-foreground',
          },
          {
            label: t('topMuscle'),
            value: data.analytics.topMuscleGroup ?? '—',
            icon: TrendingUp,
            tone: 'text-blue',
          },
          {
            label: t('friendsStat'),
            value: String(data.friendCount),
            icon: Users,
            tone: 'text-success',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-silver/10 bg-background/50 p-4"
          >
            <stat.icon
              className={`mb-2 size-4 ${stat.tone}`}
              aria-hidden="true"
            />
            <p className="font-heading text-lg font-bold tabular-nums text-foreground">
              <LtrIsolate when={isLatinFragment(stat.value)}>
                {stat.value}
              </LtrIsolate>
            </p>
            <p className="mt-0.5 text-[10px] tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <ActivityHeatmap cells={data.heatmap} weightUnit={weightUnit} />
      </section>

      <ProfileAchievements
        achievements={data.achievements ?? []}
        isSelf={data.isSelf}
      />

      <section className="mb-8">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-blue">
          {t('programs')}
        </p>
        <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
          {t('sharedSplits')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.isSelf ? t('sharedSplitsOwn') : t('sharedSplitsOther')}
        </p>
        {data.sharedSplits.length > 0 ? (
          <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3">
            {data.sharedSplits.map((split) => (
              <SharedSplitCard
                key={split.id}
                split={split}
                isOwner={data.isSelf}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-silver/20 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t('noSharedSplits')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('noSharedSplitsBody')}
            </p>
          </div>
        )}
      </section>

      {data.volumeBars.length > 0 && (
        <section className="mb-8 rounded-2xl border border-silver/10 bg-card p-5 sm:p-6">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
            {t('volumeTrend')}
          </p>
          <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
            {t('recentVolume')}
          </h2>
          <div className="mt-5 flex h-28 items-end gap-2">
            {data.volumeBars.map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-md bg-gradient-to-t from-success/20 to-success/80"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <PersonalRecordsSection
          records={data.records}
          weightUnit={weightUnit}
        />
      </section>

      <section className="mb-10">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
          {t('history')}
        </p>
        <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
          {t('recentSessions')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('recentSessionsHint')}
        </p>
        {data.sessions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-silver/20 px-4 py-10 text-center text-sm text-muted-foreground">
            {t('noSessions')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.sessions.map((session) => {
              const finished = session.finished_at ?? session.started_at
              const split = Array.isArray(session.splits)
                ? session.splits[0]
                : session.splits
              const day = Array.isArray(session.split_days)
                ? session.split_days[0]
                : session.split_days
              const mins = Math.max(
                1,
                Math.round((session.duration_seconds ?? 0) / 60),
              )
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border border-silver/10 bg-card/50 px-4 py-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-gold/[0.04] sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                      <Dumbbell className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-base font-semibold text-foreground">
                        {(() => {
                          const dayName =
                            (day as { name?: string } | null)?.name ??
                            t('dayFallback')
                          const splitName =
                            (split as { name?: string } | null)?.name ??
                            t('splitFallback')
                          return (
                            <>
                              <LtrIsolate when={isLatinFragment(dayName)}>
                                {dayName}
                              </LtrIsolate>{' '}
                              ·{' '}
                              <LtrIsolate when={isLatinFragment(splitName)}>
                                {splitName}
                              </LtrIsolate>
                            </>
                          )
                        })()}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <LtrIsolate>
                          {formatSessionDate(finished)} ·{' '}
                          {t('minutes', { count: mins })}
                        </LtrIsolate>
                      </p>
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-6 text-end sm:flex">
                    <div>
                      <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                        {t('volume')}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-gold">
                        <LtrIsolate>
                          {formatVolume(Number(session.total_volume) || 0, weightUnit)}
                        </LtrIsolate>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                        {t('sets')}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                        <LtrIsolate>
                          {session.total_sets_completed ?? 0}
                        </LtrIsolate>
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <ProfileSocialSheet
        open={listKind !== null}
        kind={listKind}
        profileUserId={data.profile.id}
        onClose={closeSocialSheet}
      />

      <FindPeopleSheet open={findOpen} onClose={closeFindSheet} />

      <AnimatePresence>
        {(sessionLoading || sessionSummary || sessionError) && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <button
              type="button"
              aria-label={t('closeSession')}
              className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm"
              onClick={closeSession}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="session-summary-title"
              className="relative z-10 max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-silver/15 bg-background p-5 shadow-2xl sm:rounded-2xl sm:p-6"
              initial={
                reduceMotion ? false : { opacity: 0, y: 40, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                    {t('recap')}
                  </p>
                  <h2
                    id="session-summary-title"
                    className="font-heading mt-1 text-xl font-bold text-foreground"
                  >
                    {t('sessionSummary')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeSession}
                  className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-silver/10 hover:text-foreground"
                  aria-label={t('close')}
                >
                  <X className="size-4" />
                </button>
              </div>
              {sessionLoading && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('loadingSession')}
                </div>
              )}
              {sessionError && (
                <p className="py-10 text-center text-sm text-destructive">
                  {sessionError}
                </p>
              )}
              {sessionSummary && <SessionSummaryCard data={sessionSummary} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen && editInitial && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <button
              type="button"
              aria-label={t('closeEdit')}
              className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm"
              onClick={() => setEditOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-profile-title"
              className="relative z-10 max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-silver/15 bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6"
              initial={
                reduceMotion ? false : { opacity: 0, y: 40, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                    {t('kicker')}
                  </p>
                  <h2
                    id="edit-profile-title"
                    className="font-heading mt-1 text-xl font-bold text-foreground"
                  >
                    {t('editProfile')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-silver/10 hover:text-foreground"
                  aria-label={t('close')}
                >
                  <X className="size-4" />
                </button>
              </div>
              <EditProfileForm
                userId={editInitial.userId}
                initial={{
                  username: editInitial.username,
                  displayName: editInitial.displayName,
                  bio: editInitial.bio,
                  avatarUrl: editInitial.avatarUrl,
                }}
                onCancel={() => setEditOpen(false)}
                onSuccess={(username) => {
                  setEditOpen(false)
                  if (username && username !== handle) {
                    router.push(`/profile/${encodeURIComponent(username)}`)
                  } else {
                    router.refresh()
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {data.isSelf && (
        <p className="sr-only">
          <Link href="/dashboard/profile/edit">{t('openFullEdit')}</Link>
        </p>
      )}
    </div>
  )
}

function StatButton({
  count,
  label,
  onClick,
  accent,
}: {
  count: number
  label: string
  onClick: () => void
  accent?: 'green'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2 py-1.5 text-start text-sm transition hover:bg-silver/5"
    >
      <LtrIsolate
        as="span"
        className={`tabular-nums ${
          accent === 'green' ? 'text-success' : 'text-foreground'
        } font-bold`}
      >
        {count}
      </LtrIsolate>{' '}
      <span className="text-muted-foreground">{label}</span>
    </button>
  )
}

/** Back-compat export name. */
export { UnifiedProfileView as PublicProfileView }
