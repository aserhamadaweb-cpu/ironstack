import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WorkoutDashboard } from '@/components/workout-dashboard'
import { getUnshownBannerCelebrations } from '@/lib/ai/celebrations'
import {
  getCompletedSessions,
  getProfile,
  getSessionLiftLogs,
  getSplitsForUser,
  getTotalVolume,
} from '@/lib/data/queries'
import { getPrimarySplitSummary } from '@/lib/data/split-recommendations-server'
import { ltrEmbed } from '@/lib/bidi'
import { computeWeeklyVolumeTrend } from '@/lib/volume-trend'
import {
  formatRelativeFinishedAt,
  formatSessionDate,
  formatVolume,
} from '@/lib/session-store'
import { getAuthIdentity } from '@/lib/supabase/server'
import { profileHref } from '@/lib/profile-path'
import { formatLiftLabel, isBodyweightLogNote, isCardioCategory } from '@/lib/units'
import { resolveLibraryExercise } from '@/lib/exercise-library.server'
import {
  formatSplitSavedDate,
  sortSplitsByRecentSaved,
} from '@/lib/split-display'

export const metadata = {
  title: 'Workout — IRONSTACK',
  description: 'Your splits, last session recap, and training programs.',
}

export default async function WorkoutPage() {
  const t = await getTranslations('workout')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [
    profileResult,
    splitsResult,
    sessionsResult,
    volumeResult,
    celebrations,
    primarySplit,
  ] = await Promise.all([
    getProfile(userId),
    getSplitsForUser(userId).catch(() => ({ data: [] as never[], error: null })),
    getCompletedSessions(userId, 100).catch(() => ({
      data: [] as never[],
      error: null,
    })),
    getTotalVolume(userId).catch(() => ({ data: 0, error: null })),
    getUnshownBannerCelebrations(userId).catch(() => []),
    getPrimarySplitSummary(userId).catch(() => ({ id: null, name: null })),
  ])

  const unreachable = Boolean(
    profileResult.error &&
      /reach the server|fetch failed|failed to fetch|session expired|jwt|sign in|not authenticated/i.test(
        profileResult.error,
      ),
  )

  const sessions = sessionsResult.data ?? []
  const latest = sessions[0] ?? null
  const latestLogsResult =
    unreachable || !latest
      ? { data: [] as never[], error: null }
      : await getSessionLiftLogs(latest.id)

  const profile = profileResult.data
  const tCommon = await getTranslations('common')
  const displayName =
    profile?.display_name || email?.split('@')[0] || tCommon('athlete')
  const unit = profile?.preferred_unit === 'lb' ? 'lb' : 'kg'
  const locale = profileResult.data?.language === 'ar' ? 'ar' : 'en'

  const splits = splitsResult.data ?? []
  const journeyVolume = volumeResult.data ?? 0

  const customSplits = sortSplitsByRecentSaved(
    splits.filter((s) => s.user_id === userId && !s.is_system),
  )

  const resolvedPrimaryId =
    primarySplit.id ?? profile?.primary_split_id ?? null

  const featuredRow =
    (resolvedPrimaryId
      ? customSplits.find((s) => s.id === resolvedPrimaryId)
      : null) ?? customSplits[0] ?? null

  const featuredSplit = featuredRow
    ? {
        id: featuredRow.id,
        slug: featuredRow.id,
        name: featuredRow.name,
        days: featuredRow.days_per_week,
        focus: featuredRow.category || t('custom'),
        description: featuredRow.description,
        isShared: Boolean(featuredRow.is_shared),
        savedDate: formatSplitSavedDate(
          featuredRow,
          locale,
        ),
      }
    : null

  const totalCustomSplits = customSplits.length

  let lastSession = null
  if (latest && !latestLogsResult.error) {
    const logs = (latestLogsResult.data ?? []).filter((log) => !log.is_skipped)
    const byLift = new Map<
      string,
      {
        name: string
        weight: number
        reps: number
        durationSeconds?: number | null
        isCardio: boolean
        repsOnly?: boolean
      }
    >()
    for (const log of logs) {
      const name = log.lift_types?.name ?? 'Lift'
      const isCardio =
        isCardioCategory(log.lift_types?.category) ||
        (Number(log.duration_seconds) || 0) > 0
      const current = byLift.get(log.lift_type_id)
      if (isCardio) {
        const duration = Number(log.duration_seconds) || 0
        if (
          duration > 0 &&
          (!current || duration > (current.durationSeconds ?? 0))
        ) {
          byLift.set(log.lift_type_id, {
            name,
            weight: 0,
            reps: 0,
            durationSeconds: duration,
            isCardio: true,
          })
        }
        continue
      }
      const repsOnly = isBodyweightLogNote(log.notes)
      if (repsOnly) {
        if (!current || log.reps > current.reps) {
          byLift.set(log.lift_type_id, {
            name,
            weight: 0,
            reps: Number(log.reps),
            isCardio: false,
            repsOnly: true,
          })
        }
        continue
      }
      if (!current || Number(log.weight) > current.weight) {
        byLift.set(log.lift_type_id, {
          name,
          weight: Number(log.weight),
          reps: Number(log.reps),
          isCardio: false,
        })
      }
    }
    const standouts = [...byLift.values()]
      .sort((a, b) => {
        if (a.isCardio && b.isCardio) {
          return (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0)
        }
        if (a.isCardio) return 1
        if (b.isCardio) return -1
        return b.weight - a.weight
      })
      .slice(0, 3)
      .map((b) => {
        const label = formatLiftLabel(
          b.name,
          b.weight,
          b.reps,
          unit,
          b.durationSeconds,
          b.repsOnly,
        )
        const catalog = resolveLibraryExercise(b.name)
        return label
          ? {
              name: b.name,
              label,
              image: catalog?.image ?? null,
              muscle: catalog?.muscles[0] ?? null,
            }
          : null
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    const durationSec = latest.duration_seconds ?? 0
    const minutes = Math.max(0, Math.round(durationSec / 60))
    const durationLabel =
      durationSec >= 3600
        ? t('durationHm', {
            h: Math.floor(durationSec / 3600),
            m: Math.round((durationSec % 3600) / 60),
          })
        : t('durationM', { m: Math.max(1, minutes) })

    const finishedAt = latest.finished_at ?? latest.started_at
    const dayName = latest.split_days?.name ?? t('dayFallback')
    const splitName = latest.splits?.name ?? t('title')

    lastSession = {
      badge: formatRelativeFinishedAt(finishedAt, locale),
      meta: ltrEmbed(`${formatSessionDate(finishedAt)} · ${durationLabel}`),
      title: `${dayName} • ${splitName}`,
      blurb: t('sessionBlurb'),
      duration: durationLabel,
      volume: formatVolume(Number(latest.total_volume) || 0, unit),
      sets: String(latest.total_sets_completed ?? 0),
      standouts,
    }
  }

  const historySessions = sessions.slice(0, 2).map((session) => ({
    id: session.id,
    date: formatSessionDate(session.started_at),
    name: `${session.split_days?.name ?? t('dayFallback')} · ${session.splits?.name ?? t('title')}`,
    duration: t('minutes', {
      count: Math.max(1, Math.round((session.duration_seconds ?? 0) / 60)),
    }),
    volume: formatVolume(Number(session.total_volume) || 0, unit),
  }))

  const volumeSeries = [...sessions]
    .reverse()
    .map((s) => Number(s.total_volume) || 0)
    .slice(-6)
  const maxVol = Math.max(...volumeSeries, 1)
  const volumeTrend = {
    bars:
      volumeSeries.length > 0
        ? volumeSeries.map((v) => Math.max(6, Math.round((v / maxVol) * 100)))
        : [8],
    caption:
      volumeSeries.length <= 1
        ? volumeSeries.length === 1
          ? t('oneSessionLogged')
          : t('noSessionsTrend')
        : (() => {
            const first = volumeSeries[0]
            const last = volumeSeries[volumeSeries.length - 1]
            const pct =
              first > 0 ? Math.round(((last - first) / first) * 100) : null
            return pct === null
              ? t('lastNSessions', { count: volumeSeries.length })
              : t('lastNSessionsPct', {
                  count: volumeSeries.length,
                  pct: ltrEmbed(`${pct >= 0 ? '+' : ''}${pct}%`),
                })
          })(),
  }

  const journeyTrend = computeWeeklyVolumeTrend(
    sessions.map((s) => ({
      started_at: s.started_at,
      finished_at: s.finished_at,
      total_volume: s.total_volume,
    })),
  )

  return (
    <WorkoutDashboard
      displayName={displayName}
      featuredSplit={featuredSplit}
      totalCustomSplits={totalCustomSplits}
      primarySplitId={resolvedPrimaryId}
      lastSession={lastSession}
      historySessions={historySessions}
      journeyVolume={journeyVolume}
      weightUnit={unit}
      volumeTrend={volumeTrend}
      journeyTrend={journeyTrend}
      avatarUrl={profile?.avatar_url}
      profileHref={profileHref(profile?.username, userId)}
      isGuest={profile?.is_guest === true}
      liveDegraded={unreachable || !profile}
      celebrations={celebrations.map((c) => ({
        id: c.id,
        title: c.title,
        body: c.body,
      }))}
    />
  )
}
