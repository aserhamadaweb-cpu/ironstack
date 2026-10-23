'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Clock3,
  House,
  Layers,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
  Trophy,
  Weight,
} from 'lucide-react'
import {
  CelebrationBanner,
  type CelebrationBannerItem,
} from '@/components/celebration-banner'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ltrEmbed } from '@/lib/bidi'
import { EmptyState } from '@/components/page-states'
import { ExerciseThumb } from '@/components/exercise-thumb'
import type { StandoutLift } from '@/lib/data/session-summary'
import {
  WorkoutSplitCard,
  type WorkoutSplitCardData,
} from '@/components/workout-split-card'
import { initialsFrom } from '@/lib/dashboard-utils'
import { OfflineFloorWorkout } from '@/components/offline-floor-workout'
import {
  getCachedSplits,
  getCachedUserId,
  getHomeSnapshot,
} from '@/lib/offline/cache'
import {
  getOfflineSplitIds,
  inspectOfflineSplit,
  removeSplitFromOffline,
  saveSplitForOffline,
} from '@/lib/offline/offline-splits'
import { offlineSaveErrorMessage } from '@/lib/offline/save-error-message'
import { subscribeOfflineCacheChanged } from '@/lib/offline/cached-user-splits'
import { useOfflineStatus } from '@/lib/offline/provider'
import { useEmbeddedSessionActive } from '@/lib/offline/embedded-session'
import {
  listLocalCompletedSessions,
  OFFLINE_CHANGED_EVENT,
} from '@/lib/offline/session-store'
import { profileHref as buildProfileHref } from '@/lib/profile-path'
import { ActiveWorkoutBanner } from '@/components/active-workout-banner'
import { ActiveWorkoutConflict } from '@/components/active-workout-conflict'
import { useActiveWorkout } from '@/lib/use-active-workout'
import { safeRouterRefresh } from '@/lib/safe-router-refresh'
import {
  createSplitChoiceHref,
  RECOMMENDED_SPLITS_PATH,
} from '@/lib/split-create-paths'
import { useGuestGate } from '@/components/guest-gate-provider'
import { CTA_PRIMARY, CTA_SECONDARY } from '@/lib/accent'
import { formatVolumeKg, type WeightUnit } from '@/lib/units'
import {
  formatLoadChangePct,
  type WeeklyVolumeTrend,
} from '@/lib/volume-trend'
type WorkoutDashboardProps = {
  displayName: string
  featuredSplit: WorkoutSplitCardData | null
  totalCustomSplits: number
  primarySplitId: string | null
  lastSession: {
    badge: string
    meta: string
    title: string
    blurb: string
    duration: string
    volume: string
    sets: string
    standouts: StandoutLift[]
  } | null
  historySessions: Array<{
    id: string
    date: string
    name: string
    duration: string
    volume: string
  }>
  journeyVolume: number
  weightUnit?: WeightUnit
  volumeTrend: {
    bars: number[]
    caption: string
  }
  journeyTrend: WeeklyVolumeTrend
  celebrations?: CelebrationBannerItem[]
  avatarUrl?: string | null
  profileHref?: string
  isGuest?: boolean
  liveDegraded?: boolean
}

/** Survives RSC remounts so reconnect reload does not loop. */
let workoutLiveReloadLock: string | null = null

function pickFeaturedSplit(
  splits: WorkoutSplitCardData[],
  primarySplitId: string | null,
): WorkoutSplitCardData | null {
  if (splits.length === 0) return null
  if (primarySplitId) {
    const primary = splits.find(
      (s) => s.id === primarySplitId || s.slug === primarySplitId,
    )
    if (primary) return primary
  }
  return splits[0]
}

export function WorkoutDashboard({
  displayName,
  featuredSplit: initialFeaturedSplit,
  primarySplitId,
  lastSession,
  historySessions,
  journeyVolume,
  weightUnit = 'kg',
  volumeTrend,
  journeyTrend,
  celebrations = [],
  avatarUrl,
  profileHref,
  isGuest = false,
  liveDegraded = false,
}: WorkoutDashboardProps) {
  const t = useTranslations('workout')
  const tHome = useTranslations('homeWorkouts')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const { online, hydrated, refresh, lastError, syncing } = useOfflineStatus()
  const embeddedSession = useEmbeddedSessionActive()
  const [featuredSplit, setFeaturedSplit] = useState(initialFeaturedSplit)
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getHomeSnapshot>
  >>(null)
  const [history, setHistory] = useState(historySessions)
  const [recap, setRecap] = useState(lastSession)
  const [localVolume, setLocalVolume] = useState<number | null>(null)
  const [liveReloadError, setLiveReloadError] = useState<string | null>(null)
  const [liveReloading, setLiveReloading] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const { active: activeWorkout, refresh: refreshActiveWorkout } = useActiveWorkout()
  const [startBlocked, setStartBlocked] = useState(false)
  const [offlineSaved, setOfflineSaved] = useState(false)
  const [offlineIncomplete, setOfflineIncomplete] = useState(false)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [offlineProgress, setOfflineProgress] = useState<number | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const tOffline = useTranslations('offline')

  useEffect(() => {
    void getHomeSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
  }, [])

  useEffect(() => {
    const featuredId = featuredSplit?.id
    if (!featuredId) {
      setOfflineSaved(false)
      setOfflineIncomplete(false)
      return
    }
    let cancelled = false
    const loadPins = () => {
      void Promise.all([
        getOfflineSplitIds(),
        inspectOfflineSplit(featuredId),
      ])
        .then(([ids, status]) => {
          if (cancelled) return
          const pinned = ids.includes(featuredId)
          setOfflineSaved(pinned && status.ready)
          setOfflineIncomplete(pinned && !status.ready)
        })
        .catch(() => {
          if (!cancelled) {
            setOfflineSaved(false)
            setOfflineIncomplete(false)
          }
        })
    }
    loadPins()
    const unsubscribe = subscribeOfflineCacheChanged(loadPins)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [featuredSplit?.id])

  useEffect(() => {
    if (!hydrated) return
    if (!online) {
      workoutLiveReloadLock = null
      setLiveReloadError(null)
      setLiveReloading(false)
      return
    }
    if (!liveDegraded) {
      setLiveReloadError(null)
      setLiveReloading(false)
      return
    }

    const lockKey = `online:${retryNonce}`
    if (workoutLiveReloadLock === lockKey) return
    workoutLiveReloadLock = lockKey

    let cancelled = false
    const maxAttempts = 4

    const run = async (attempt: number) => {
      if (cancelled) return
      setLiveReloading(true)
      setLiveReloadError(null)
      try {
        await Promise.race([
          refresh(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 15_000)
          }),
        ])
        if (cancelled) return
        safeRouterRefresh(router)
        setLiveReloading(false)
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error && err.message === 'timeout'
            ? t('liveReloadTimeout')
            : err instanceof Error
              ? err.message
              : t('liveReloadTimeout')
        if (attempt < maxAttempts) {
          window.setTimeout(() => {
            void run(attempt + 1)
          }, 2_000 * attempt)
          return
        }
        setLiveReloading(false)
        setLiveReloadError(message)
      }
    }

    void run(1)
    return () => {
      cancelled = true
    }
  }, [hydrated, online, liveDegraded, refresh, router, t, retryNonce])

  useEffect(() => {
    setHistory(historySessions)
    setRecap(lastSession)
  }, [historySessions, lastSession])

  useEffect(() => {
    setFeaturedSplit(initialFeaturedSplit)
  }, [initialFeaturedSplit])

  useEffect(() => {
    const mergeCards = (
      server: WorkoutSplitCardData[],
      local: WorkoutSplitCardData[],
    ) => {
      const ids = new Set(server.flatMap((s) => [s.id, s.slug]))
      return [
        ...server,
        ...local.filter((s) => !ids.has(s.id) && !ids.has(s.slug)),
      ]
    }

    let cancelled = false
    async function hydrateFromCache() {
      try {
        const [cached, uid, localSessions] = await Promise.all([
          getCachedSplits(),
          getCachedUserId(),
          listLocalCompletedSessions().catch(() => []),
        ])
        if (cancelled) return

        const yoursFromCache: WorkoutSplitCardData[] = cached
          .filter(
            (row) =>
              row?.detail &&
              row?.row &&
              row.row.user_id === uid &&
              !row.row.is_system,
          )
          .map((row) => ({
            id: row.detail.slug,
            slug: row.detail.slug,
            name: row.detail.name,
            days: row.detail.daysPerWeek,
            focus: row.detail.tag,
            description: row.detail.description,
            isShared: row.detail.isShared,
          }))

        const serverList = initialFeaturedSplit ? [initialFeaturedSplit] : []
        const merged = mergeCards(serverList, yoursFromCache)
        setFeaturedSplit(pickFeaturedSplit(merged, primarySplitId))

        const knownIds = new Set(historySessions.map((row) => row.id))
        const extraHistory = localSessions
          .filter((session) => !knownIds.has(session.id))
          .map((session) => {
            const split = cached.find((row) => row.id === session.splitId)
            const volume = session.logs.reduce((sum, log) => {
              if (log.isSkipped || (log.durationSeconds ?? 0) > 0) return sum
              return sum + (Number(log.weight) || 0) * (Number(log.reps) || 0)
            }, 0)
            const minutes = Math.max(
              0,
              Math.round((session.durationSeconds ?? 0) / 60),
            )
            return {
              id: session.id,
              date: new Date(
                session.finishedAt ?? session.startedAt,
              ).toLocaleDateString(),
              name: split?.detail.name ?? t('title'),
              duration: `${minutes} min`,
              volume: formatVolumeKg(volume, weightUnit),
              sets: session.logs.filter((log) => !log.isSkipped).length,
              volumeKg: volume,
            }
          })
        const localKg = localSessions.reduce((sum, session) => {
          return (
            sum +
            session.logs.reduce((inner, log) => {
              if (log.isSkipped || (log.durationSeconds ?? 0) > 0) return inner
              return inner + (Number(log.weight) || 0) * (Number(log.reps) || 0)
            }, 0)
          )
        }, 0)
        if (localKg > 0) setLocalVolume(localKg)
        if (extraHistory.length > 0) {
          setHistory(
            extraHistory
              .map((session) => {
                const { sets, volumeKg, ...row } = session
                void sets
                void volumeKg
                return row
              })
              .concat(historySessions)
              .slice(0, 8),
          )
          if (!lastSession) {
            const first = extraHistory[0]
            setRecap({
              badge: t('custom'),
              meta: first.date,
              title: first.name,
              blurb: t('subtitle'),
              duration: first.duration,
              volume: first.volume,
              sets: String(first.sets),
              standouts: [],
            })
          }
        }

        // Prefetch only the featured/next session — not every custom split RSC tree.
        const featuredSlug =
          merged.find((s) => s.id === primarySplitId || s.slug === primarySplitId)
            ?.slug ?? merged[0]?.slug
        if (featuredSlug) {
          router.prefetch(`/dashboard/splits/${featuredSlug}/session`)
        }
      } catch {
        /* IndexedDB unavailable */
      }
    }
    void hydrateFromCache()
    window.addEventListener(OFFLINE_CHANGED_EVENT, hydrateFromCache)
    return () => {
      cancelled = true
      window.removeEventListener(OFFLINE_CHANGED_EVENT, hydrateFromCache)
    }
  }, [
    initialFeaturedSplit,
    historySessions,
    lastSession,
    primarySplitId,
    router,
    t,
    weightUnit,
  ])

  const resolvedName = liveDegraded
    ? snapshot?.displayName || displayName
    : displayName || snapshot?.displayName || displayName
  const resolvedAvatar = liveDegraded
    ? snapshot?.avatarUrl ?? avatarUrl
    : avatarUrl ?? snapshot?.avatarUrl
  const resolvedHref =
    profileHref ||
    buildProfileHref(snapshot?.username, snapshot?.userId)
  const resolvedGuest = isGuest || snapshot?.isGuest === true
  const shownVolume =
    journeyVolume > 0 ? journeyVolume : localVolume ?? journeyVolume
  const firstName = resolvedName.trim().split(/\s+/)[0] || resolvedName
  const hasPrimary =
    Boolean(primarySplitId) &&
    Boolean(
      featuredSplit &&
        (featuredSplit.id === primarySplitId ||
          featuredSplit.slug === primarySplitId),
    )

  const startSplit = (slug: string) => {
    requireAccount('startSession', () => {
      if (activeWorkout && activeWorkout.splitId !== slug) {
        setStartBlocked(true)
        return
      }
      router.push(`/dashboard/splits/${slug}/session`)
    })
  }

  const handleToggleOffline = (splitId: string, next: boolean) => {
    if (offlineBusy) return
    requireAccount('saveSplit', () => {
      if (!online) {
        setOfflineError(tOffline('splitRequiresConnection'))
        return
      }
      setOfflineError(null)
      setOfflineBusy(true)
      setOfflineProgress(next ? 0 : null)
      void (async () => {
        try {
          if (next) {
            const result = await saveSplitForOffline(splitId, {
              onProgress: (p) => setOfflineProgress(p.percent),
            })
            if (!result.ok) {
              setOfflineError(offlineSaveErrorMessage(tOffline, result))
              setOfflineSaved(false)
              return
            }
            setOfflineSaved(true)
            setOfflineIncomplete(false)
          } else {
            const result = await removeSplitFromOffline(splitId)
            setOfflineSaved(false)
            setOfflineIncomplete(false)
            if (result.retainedForSession) {
              setOfflineError(tOffline('offlineUnsaveKeptForSession'))
            } else if (result.retainedForMutation) {
              setOfflineError(tOffline('offlineUnsaveKeptForMutation'))
            }
          }
        } catch (err) {
          setOfflineError(
            err instanceof Error ? err.message : tOffline('offlineSaveFailed'),
          )
        } finally {
          setOfflineBusy(false)
          setOfflineProgress(null)
        }
      })()
    })
  }

  const goCreateSplit = () => {
    if (resolvedGuest) {
      router.push(RECOMMENDED_SPLITS_PATH)
      return
    }
    router.push(createSplitChoiceHref())
  }

  if (hydrated && (!online || embeddedSession)) {
    return (
      <OfflineFloorWorkout
        displayName={resolvedName}
        avatarUrl={resolvedAvatar}
        profileHref={resolvedHref}
        isGuest={resolvedGuest}
        includeNav={false}
      />
    )
  }


  const journeySparkBars = journeyTrend.bars
  const loadPctLabel =
    journeyTrend.loadChangePct === null
      ? null
      : ltrEmbed(formatLoadChangePct(Math.abs(journeyTrend.loadChangePct)))

  const journeyLoadMessage = (() => {
    if (loadPctLabel === null) return null
    switch (journeyTrend.loadInsight) {
      case 'up':
        return t('loadUp', { pct: loadPctLabel })
      case 'down':
        return t('loadDown', { pct: loadPctLabel })
      case 'flat':
        return t('loadFlat')
      default:
        return null
    }
  })()

  const journeyTrendCaption =
    shownVolume === 0
      ? t('journeyStart')
      : journeyTrend.loadInsight === 'baseline'
        ? t('journeyBaseline')
        : t('weeklyVolumeCaption', { weeks: journeyTrend.weeksWithSessions })

  const JourneyTrendIcon =
    journeyTrend.loadInsight === 'down'
      ? TrendingDown
      : journeyTrend.loadInsight === 'flat'
        ? Minus
        : TrendingUp

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[55svh] [mask-image:linear-gradient(to_bottom,black_10%,transparent)]">
          <Image
            src="/images/hero-gym.png"
            alt=""
            fill
            className="object-cover opacity-[0.14]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/55 to-background" />
        </div>
        <div className="absolute inset-0 gold-radial-wash opacity-40" />
      </div>


      {startBlocked && activeWorkout ? (
        <ActiveWorkoutConflict
          active={activeWorkout}
          onResolved={() => {
            setStartBlocked(false)
            void refreshActiveWorkout()
          }}
          onStay={() => setStartBlocked(false)}
        />
      ) : null}

      <main
        data-tour="page-workout"
        className="mx-auto max-w-7xl min-w-0 overflow-x-clip px-4 py-6 sm:px-6 sm:py-8 md:py-12"
      >
            {(liveDegraded && online && (liveReloading || liveReloadError || lastError || syncing)) && (
              <div className="mb-6 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-foreground">
                <p>
                  {liveReloadError || lastError || t('liveReload')}
                </p>
                {(liveReloadError || lastError) && (
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-10 items-center rounded-full border border-gold/40 px-4 text-xs font-bold tracking-[0.14em] text-gold"
                    onClick={() => {
                      workoutLiveReloadLock = null
                      setRetryNonce((n) => n + 1)
                    }}
                  >
                    {t('liveRetry')}
                  </button>
                )}
              </div>
            )}
            {celebrations.length > 0 && (
              <CelebrationBanner items={celebrations} />
            )}
            <ActiveWorkoutBanner />

            <div className="mb-8 max-w-xl">
              <p className="section-kicker">{t('kicker')}</p>
              <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                {t('ready', { name: firstName })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
              <div
                className={`mt-5 grid gap-2 ${featuredSplit ? 'grid-cols-2' : 'grid-cols-1'}`}
              >
                {featuredSplit ? (
                  <button
                    type="button"
                    data-tour="workout-start-cta"
                    onClick={() => startSplit(featuredSplit.slug)}
                    className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-3 text-center ${CTA_PRIMARY}`}
                  >
                    {t('startSession')}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-tour="workout-create-cta"
                  onClick={goCreateSplit}
                  className={`inline-flex min-h-12 w-full items-center justify-center gap-2 px-3 text-center ${
                    featuredSplit ? CTA_SECONDARY : CTA_PRIMARY
                  }`}
                >
                  <Plus className="size-4 shrink-0" aria-hidden="true" />
                  {t('createSplit')}
                </button>
              </div>
              {recap === null ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('firstSessionTip')}
                </p>
              ) : null}
            </div>

            {/* Total Volume + Progress — first section */}
            <section className="is-panel mb-8 p-5 sm:mb-10 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="section-kicker">{t('yourJourney')}</p>
                  <LtrIsolate
                    as="p"
                    className="font-heading mt-3 text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl"
                  >
                    {formatVolumeKg(shownVolume, weightUnit).replace(
                      ` ${weightUnit}`,
                      '',
                    )}{' '}
                    <span className="text-2xl font-semibold text-gold sm:text-3xl">
                      {weightUnit}
                    </span>
                  </LtrIsolate>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    {t('liftedSince')}
                  </p>
                  {journeyLoadMessage ? (
                    <div
                      className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${
                        journeyTrend.loadInsight === 'down'
                          ? 'border-heat/30 bg-heat-tint'
                          : journeyTrend.loadInsight === 'flat'
                            ? 'border-border bg-muted/40'
                            : 'border-success/30 bg-success-tint'
                      }`}
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
                          journeyTrend.loadInsight === 'down'
                            ? 'chip-amber'
                            : journeyTrend.loadInsight === 'flat'
                              ? 'border-border bg-background'
                              : 'chip-green'
                        }`}
                      >
                        <JourneyTrendIcon className="size-4" aria-hidden="true" />
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {journeyLoadMessage}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="w-full shrink-0 rounded-2xl border border-border bg-background p-4 lg:w-64">
                  <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                    {t('trend')}
                  </p>
                  <div
                    className="flex h-24 items-end gap-1.5"
                    aria-hidden="true"
                  >
                    {journeySparkBars.map((height, index) => (
                      <div
                        key={index}
                        className={`w-full rounded-t-sm bg-gradient-to-t ${
                          journeyTrend.weeklyVolumes[index] > 0
                            ? 'from-success/20 to-success/85'
                            : 'from-muted/20 to-muted/50'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <p
                    className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${
                      journeyTrend.loadInsight === 'down'
                        ? 'text-heat'
                        : journeyTrend.loadInsight === 'flat'
                          ? 'text-muted-foreground'
                          : 'text-success'
                    }`}
                  >
                    <JourneyTrendIcon className="size-3.5" aria-hidden="true" />
                    <LtrIsolate when={isLatinFragment(journeyTrendCaption)}>
                      {journeyTrendCaption}
                    </LtrIsolate>
                  </p>
                </div>
              </div>
            </section>

            {/* Featured split — one program only */}
            <section className="mb-10 min-w-0" data-tour="workout-splits">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="section-kicker">{t('yourSplitsKicker')}</p>
                  <h2 className="font-heading mt-1 text-2xl font-bold text-foreground md:text-3xl">
                    {t('activeProgram')}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {hasPrimary
                      ? t('trainSplitsHintPrimary')
                      : t('trainSplitsHintLatest')}
                  </p>
                </div>
                <Link
                  href="/dashboard/splits"
                  data-tour="workout-my-splits-link"
                  className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background sm:w-auto"
                >
                  <Layers className="size-4" aria-hidden="true" />
                  {t('manageYourSplits')}
                  <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
                </Link>
              </div>

              {featuredSplit === null ? (
                <EmptyState
                  icon={Layers}
                  title={t('noSplits')}
                  body={t('noSplitsBody')}
                  tone="silver"
                />
              ) : (
                <div className="max-w-xl" data-tour="workout-featured-split">
                  {offlineError ? (
                    <p role="alert" className="mb-3 text-sm text-destructive">
                      {offlineError}
                    </p>
                  ) : null}
                  <WorkoutSplitCard
                    split={featuredSplit}
                    primarySplitId={primarySplitId}
                    isShared={Boolean(featuredSplit.isShared)}
                    compact
                    savedForOffline={offlineSaved}
                    offlineIncomplete={offlineIncomplete}
                    savingOffline={offlineBusy}
                    offlineProgress={offlineProgress}
                    onToggleOffline={handleToggleOffline}
                    onStart={startSplit}
                  />
                </div>
              )}
            </section>

            {/* Last Session Summary */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  {t('recap')}
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
                  {t('lastSession')}
                </h2>
              </div>

              {recap === null ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-card/35 px-6 py-14 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-silver/20 bg-silver/5 text-silver">
                    <Trophy className="size-6" aria-hidden="true" />
                  </div>
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {t('noSessionsRecap')}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t('noSessionsRecapBody')}
                  </p>
                </div>
              ) : (
                <article className="glass-card rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <div className="flex flex-col gap-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <LtrIsolate
                          as="span"
                          when={isLatinFragment(recap.badge)}
                          className="rounded-full border badge-amber px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]"
                        >
                          {recap.badge}
                        </LtrIsolate>
                        <LtrIsolate
                          as="span"
                          className="text-xs text-muted-foreground"
                        >
                          {recap.meta}
                        </LtrIsolate>
                      </div>
                      <h3 className="font-heading mt-3 text-xl font-bold text-foreground sm:text-2xl">
                        {recap.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {recap.blurb}
                      </p>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { label: t('duration'), value: recap.duration, icon: Clock3 },
                          { label: t('volume'), value: recap.volume, icon: Weight },
                          { label: t('sets'), value: recap.sets, icon: Layers },
                        ].map((stat) => (
                          <div
                            key={stat.label}
                            className="rounded-xl border border-silver/10 bg-background/50 p-3"
                          >
                            <stat.icon
                              className="mb-2 size-4 text-gold"
                              aria-hidden="true"
                            />
                            <LtrIsolate
                              as="p"
                              when={isLatinFragment(stat.value)}
                              className="font-heading text-lg font-bold tabular-nums text-foreground"
                            >
                              {stat.value}
                            </LtrIsolate>
                            <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                              {stat.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-2.5">
                        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                          {t('standoutLifts')}
                        </p>
                        {recap.standouts.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t('noStandouts')}
                          </p>
                        )}
                        {recap.standouts.map((lift) => (
                          <div
                            key={lift.label}
                            className="flex min-h-11 items-center gap-3 rounded-xl border border-silver/10 bg-background/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-gold/30 hover:bg-gold/5"
                          >
                            <ExerciseThumb
                              muscle={lift.muscle || 'Core'}
                              image={lift.image}
                              name={lift.name}
                              className="size-10"
                            />
                            <LtrIsolate>{lift.label}</LtrIsolate>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-full rounded-xl border border-border bg-background p-4">
                      <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                        {t('volumeTrend')}
                      </p>
                      <div
                        className="flex h-28 items-end gap-1.5"
                        aria-hidden="true"
                      >
                        {volumeTrend.bars.map((height, index) => (
                          <div
                            key={index}
                            className="w-full rounded-t-sm bg-gradient-to-t from-success/20 to-success/80 transition-all hover:to-success"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <LtrIsolate
                        as="p"
                        when={isLatinFragment(volumeTrend.caption)}
                        className="mt-3 text-xs font-semibold text-success"
                      >
                        {volumeTrend.caption}
                      </LtrIsolate>
                    </div>
                  </div>
                </article>
              )}
            </section>

            <section className="mb-8 sm:mb-10">
              <Link
                href="/dashboard/home-workouts"
                className="is-panel flex flex-col gap-4 p-5 transition hover:border-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <House className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="section-kicker">{tHome('kicker')}</p>
                    <h2 className="font-heading mt-1 text-xl font-bold text-headline">
                      {t('homeWorkoutsTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('homeWorkoutsBody')}
                    </p>
                  </div>
                </div>
                <span className="inline-flex min-h-11 items-center justify-center gap-1 text-xs font-semibold tracking-[0.12em] text-gold">
                  {t('openHomeWorkouts')}
                </span>
              </Link>
            </section>

            {/* Exercise progress */}
            <section className="mb-6">
              <div className="is-panel overflow-hidden p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                      {t('progressKicker')}
                    </p>
                    <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
                      {t('progressTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('progressBody')}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/progress"
                    className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-5 text-xs font-bold tracking-[0.12em] text-gold transition hover:bg-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:w-auto"
                  >
                    <TrendingUp className="size-4" aria-hidden="true" />
                    {t('openProgress')}
                    <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          </main>
    </div>
  )
}
