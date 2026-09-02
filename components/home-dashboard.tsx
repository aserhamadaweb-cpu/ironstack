'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, BrainCircuit, ChevronRight, Compass, Dumbbell, History, Medal, Settings, Swords, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AppShortcutGrid, type AppShortcut } from '@/components/app-shortcuts'
import { BrandSocialLinks, DiscordIcon } from '@/components/brand-social-links'
import { DashboardNav } from '@/components/dashboard-nav'
import {
  LeaderboardSection,
  type LeaderboardRow,
} from '@/components/leaderboard-section'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { StreakBadge } from '@/components/streak-badge'
import { StreakFlame } from '@/components/streak-flame'
import { TrainingCircleFeed } from '@/components/training-circle-feed'
import { UserAvatar } from '@/components/user-avatar'
import { useIsGuest } from '@/components/use-is-guest'
import { ActiveWorkoutBanner } from '@/components/active-workout-banner'
import { CTA_PRIMARY } from '@/lib/accent'
import { initialsFrom } from '@/lib/dashboard-utils'
import {
  getHomeSnapshot,
  saveHomeSnapshot,
} from '@/lib/offline/cache'
import { OfflineFloorHome } from '@/components/offline-floor-home'
import { useOfflineStatus } from '@/lib/offline/provider'
import { profileHref } from '@/lib/profile-path'
import type { WeightUnit } from '@/lib/units'

function isPlaceholderGuestEmail(email: string) {
  const value = email.trim()
  if (!value) return false
  if (/^guest[0-9a-f]+@/i.test(value)) return true
  const at = value.indexOf('@')
  return at >= 0 && !value.slice(at + 1).includes('.')
}

type WeekDay = { day: string; done: boolean }

type FriendAvatar = {
  id: string
  name: string
  initials: string
  tone: string
  username?: string | null
  avatarUrl?: string | null
}

type HomeDashboardProps = {
  displayName: string
  email: string
  username?: string
  isGuest?: boolean
  weekActivity: WeekDay[]
  weekSessionCount: number
  streakDays: number
  streakHoursLeft?: number | null
  lastSessionCaption: string
  friends: FriendAvatar[]
  currentUserId: string
  weightUnit: WeightUnit
  leaderboard: {
    globalRows: LeaderboardRow[]
    friendsRows: LeaderboardRow[]
    friendCount: number
  }
  avatarUrl?: string | null
  liveDegraded?: boolean
}

export function HomeDashboard({
  displayName,
  email,
  username,
  isGuest: isGuestProp = false,
  weekActivity,
  weekSessionCount,
  streakDays,
  streakHoursLeft = null,
  lastSessionCaption,
  friends,
  currentUserId,
  weightUnit,
  leaderboard,
  avatarUrl,
  liveDegraded = false,
}: HomeDashboardProps) {
  const t = useTranslations('home')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tGuest = useTranslations('guest')
  const { isGuest: isGuestClient } = useIsGuest()
  const isGuest = isGuestProp || isGuestClient
  const { online, hydrated } = useOfflineStatus()
  const [discordNotice, setDiscordNotice] = useState<string | null>(null)
  const [cached, setCached] = useState<Awaited<
    ReturnType<typeof getHomeSnapshot>
  >>(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    router.prefetch('/dashboard/workout')
  }, [router])

  useEffect(() => {
    void getHomeSnapshot()
      .then((snap) => {
        if (snap) setCached(snap)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (liveDegraded || !currentUserId || !displayName) {
      return
    }
    void saveHomeSnapshot({
      userId: currentUserId,
      displayName,
      email,
      username: username ?? null,
      avatarUrl: avatarUrl ?? null,
      isGuest: isGuestProp,
      weightUnit,
      lastSessionCaption,
      streakDays,
      streakHoursLeft,
      weekActivity,
      weekSessionCount,
    }).catch(() => false)
  }, [
    liveDegraded,
    currentUserId,
    displayName,
    email,
    username,
    avatarUrl,
    isGuestProp,
    weightUnit,
    lastSessionCaption,
    streakDays,
    streakHoursLeft,
    weekActivity,
    weekSessionCount,
  ])

  const resolvedName = liveDegraded
    ? cached?.displayName || displayName
    : displayName || cached?.displayName || displayName
  const resolvedEmail = liveDegraded ? cached?.email || email : email || cached?.email
  const resolvedUsername = liveDegraded
    ? cached?.username ?? username
    : username ?? cached?.username
  const resolvedAvatar = liveDegraded
    ? cached?.avatarUrl ?? avatarUrl
    : avatarUrl ?? cached?.avatarUrl
  const resolvedUserId = cached?.userId || currentUserId
  const resolvedWeek = cached?.weekActivity?.length ? cached.weekActivity : weekActivity
  const resolvedWeekCount = cached?.weekSessionCount ?? weekSessionCount
  const resolvedStreak = cached?.streakDays ?? streakDays
  const resolvedHours = cached?.streakHoursLeft ?? streakHoursLeft
  const resolvedLast = cached?.lastSessionCaption || lastSessionCaption
  const firstName = resolvedName.trim().split(/\s+/)[0] || resolvedName

  if (hydrated && !online) {
    return (
      <OfflineFloorHome
        displayName={resolvedName}
        initials={initialsFrom(resolvedName)}
        avatarUrl={resolvedAvatar}
        profileHref={profileHref(resolvedUsername, resolvedUserId)}
        isGuest={isGuest}
        weekActivity={resolvedWeek}
        lastSessionCaption={resolvedLast}
      />
    )
  }

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[70svh] [mask-image:linear-gradient(to_bottom,black_15%,transparent)]">
          <Image
            src="/images/hero-gym.png"
            alt=""
            fill
            className="object-cover opacity-[0.16]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/55 to-background" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(232,181,74,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_36%_28%_at_92%_20%,rgba(198,40,40,0.08),transparent_55%)]" />
        <div className="absolute top-[40%] -start-32 h-80 w-80 rounded-full bg-silver/[0.04] blur-3xl" />
      </div>

      <DashboardNav
        userName={resolvedName}
        initials={initialsFrom(resolvedName)}
        profileHref={profileHref(resolvedUsername, resolvedUserId)}
        avatarUrl={resolvedAvatar}
        isGuest={isGuest}
      />

      <main
        data-tour="page-home"
        className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:py-12"
      >
        <ActiveWorkoutBanner />
        <section
          className="is-panel relative mb-8 overflow-hidden p-5 sm:mb-10 sm:p-8 md:p-10"
          data-tour="home-hero"
        >
          <div
            className="pointer-events-none absolute -top-16 -end-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-16 -start-8 h-36 w-36 rounded-full bg-heat/8 blur-3xl"
            aria-hidden="true"
          />
          <Dumbbell
            className="absolute -end-4 -bottom-8 size-40 -rotate-12 text-silver opacity-[0.08] sm:-end-8 sm:-bottom-10 sm:size-56"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <UserAvatar
                name={resolvedName}
                username={resolvedUsername}
                userId={resolvedUserId}
                avatarUrl={resolvedAvatar}
                size="xl"
              />
              <div className="min-w-0">
                <p className="section-kicker">{t('welcomeKicker')}</p>
                <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-headline sm:text-4xl">
                  {t('hey', { name: firstName })}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isGuest || isPlaceholderGuestEmail(resolvedEmail ?? '') ? (
                    tGuest('accountLabel')
                  ) : (
                    <>
                      {resolvedUsername ? `@${resolvedUsername}` : null}
                      {resolvedUsername && resolvedEmail ? (
                        <span className="mx-2 text-muted-foreground">·</span>
                      ) : null}
                      {resolvedEmail ? (
                        <span className="hidden break-all sm:inline">{resolvedEmail}</span>
                      ) : null}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center gap-3 md:flex-col md:items-end"
              data-tour="home-streak"
            >
              <StreakBadge streakDays={resolvedStreak} hoursLeft={resolvedHours} />
              <Link
                href={profileHref(resolvedUsername, resolvedUserId)}
                prefetch={false}
                className="btn-pill btn-pill-ghost inline-flex min-h-11 items-center gap-1 px-0 text-xs"
              >
                {tCommon('viewFullProfile')}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-8 sm:mb-10" data-tour="home-shortcuts">
          <p className="section-kicker mb-3">{t('jumpTo')}</p>
          <AppShortcutGrid
            items={
              [
                {
                  href: '/dashboard/workout',
                  label: tNav('tabWorkout'),
                  icon: Dumbbell,
                  tourIcon: 'home-shortcut-workout-icon',
                },
                {
                  href: '/dashboard/explore',
                  label: tNav('explore'),
                  icon: Compass,
                },
                {
                  href: '/dashboard/history',
                  label: tNav('history'),
                  icon: History,
                },
                ...(!isGuest
                  ? [
                      {
                        href: '/dashboard/challenges',
                        label: tNav('challenges'),
                        icon: Swords,
                      },
                    ]
                  : []),
                {
                  href: '/dashboard/records',
                  label: tNav('prs'),
                  icon: Trophy,
                },
                {
                  href: '/dashboard/achievements',
                  label: tNav('jumpAchievements'),
                  icon: Medal,
                },
                ...(!isGuest
                  ? [
                      {
                        href: '/dashboard/ai-coach',
                        label: tNav('coach'),
                        icon: BrainCircuit,
                      },
                    ]
                  : []),
                {
                  href: '/dashboard/settings',
                  label: tNav('settings'),
                  icon: Settings,
                },
              ] satisfies AppShortcut[]
            }
          />
        </section>

        <section className="mb-8 sm:mb-10">
          <article className="is-panel p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-[#5865F2] text-white">
                  <DiscordIcon className="size-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-bold text-headline sm:text-xl">
                    {t('discordCommunityTitle')}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t('discordCommunityBody')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDiscordNotice(t('discordComingSoon'))}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-[18px] py-2.5 text-sm font-semibold text-white transition-colors active:opacity-80"
                >
                  <DiscordIcon className="size-4" />
                  {t('discordJoin')}
                </button>
                <BrandSocialLinks />
              </div>
            </div>
            {discordNotice && (
              <p
                role="status"
                className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold/80"
              >
                {discordNotice}
              </p>
            )}
          </article>
        </section>

        <section className="mb-8 sm:mb-10">
          <article className="is-panel p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-kicker">{t('thisWeek')}</p>
                <h2 className="font-heading mt-1 text-xl font-bold text-headline">
                  {t('recentActivity')}
                </h2>
              </div>
              <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border badge-heat px-3 py-1 text-[10px] font-semibold tabular-nums">
                <Activity className="size-3" aria-hidden="true" />
                {resolvedWeekCount}{' '}
                {tCommon('sessions', { count: resolvedWeekCount })}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1 max-[380px]:gap-0.5 sm:gap-2">
              {resolvedWeek.map((day) => (
                <div key={day.day} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <div
                    className="relative flex aspect-square w-full min-h-[2.25rem] items-center justify-center overflow-hidden rounded-xl"
                    aria-label={
                      day.done
                        ? t('dayTrained', { day: day.day })
                        : t('dayRest', { day: day.day })
                    }
                  >
                    <StreakFlame
                      active={day.done}
                      className="h-[88%] w-[88%]"
                    />
                  </div>
                  <span className="text-[9px] tracking-wider text-muted-foreground max-[380px]:tracking-normal sm:text-[10px]">
                    {day.day}
                  </span>
                </div>
              ))}
            </div>
            <LtrIsolate
              as="p"
              when={isLatinFragment(resolvedLast)}
              className="mt-4 text-sm text-muted-foreground"
            >
              {resolvedLast}
            </LtrIsolate>
          </article>
        </section>

        {!isGuest && (
        <section className="mb-8 sm:mb-10" data-tour="home-social">
          <TrainingCircleFeed friends={friends} />
        </section>
        )}

        <section className="mb-8 sm:mb-10" data-tour="home-leaderboard">
          <LeaderboardSection
            currentUserId={resolvedUserId}
            globalRows={leaderboard.globalRows}
            friendsRows={isGuest ? [] : leaderboard.friendsRows}
            friendCount={isGuest ? 0 : leaderboard.friendCount}
            hideFriendsTab={isGuest}
          />
        </section>

        <section className="is-panel mb-8 p-5 sm:mb-10 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">{t('readyKicker')}</p>
              <h2 className="font-heading mt-1 text-2xl font-bold text-headline md:text-3xl">
                {t('readyTitle')}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t('readyBody')}
              </p>
            </div>
            <Link
              href="/dashboard/workout"
              className={`cta-pulse shrink-0 px-8 ${CTA_PRIMARY}`}
            >
              {tCommon('openWorkout')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
