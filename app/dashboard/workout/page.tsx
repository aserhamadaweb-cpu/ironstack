import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageError } from '@/components/page-states'
import { WorkoutDashboard } from '@/components/workout-dashboard'
import { getUnshownBannerCelebrations } from '@/lib/ai/celebrations'
import { getCachedCoachInsight } from '@/lib/ai/insights'
import {
  getCompletedSessions,
  getProfile,
  getSessionLiftLogs,
  getSplitsForUser,
  getTotalVolume,
} from '@/lib/data/queries'
import { ltrEmbed } from '@/lib/bidi'
import {
  formatRelativeFinishedAt,
  formatSessionDate,
  formatVolume,
} from '@/lib/session-store'
import { getAuthIdentity } from '@/lib/supabase/server'
import { profileHref } from '@/lib/profile-path'
import { formatLiftLabel, isCardioCategory } from '@/lib/units'

export const metadata = {
  title: 'Workout — IRONSTACK',
  description: 'Your splits, last session recap, and recommended programs.',
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
    insight,
    celebrations,
  ] = await Promise.all([
    getProfile(userId),
    getSplitsForUser(userId),
    getCompletedSessions(userId, 8),
    getTotalVolume(userId),
    getCachedCoachInsight(userId),
    getUnshownBannerCelebrations(userId),
  ])

  const error =
    profileResult.error ||
    splitsResult.error ||
    sessionsResult.error ||
    volumeResult.error

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={error} />
      </main>
    )
  }

  const profile = profileResult.data
  const tCommon = await getTranslations('common')
  const displayName =
    profile?.display_name || email?.split('@')[0] || tCommon('athlete')
  const unit = profile?.preferred_unit === 'lb' ? 'lb' : 'kg'
  const locale = profileResult.data?.language === 'ar' ? 'ar' : 'en'

  const splits = splitsResult.data ?? []
  const sessions = sessionsResult.data ?? []
  const journeyVolume = volumeResult.data ?? 0

  const yourSplits = splits
    .filter((s) => s.user_id === userId && !s.is_system)
    .slice(0, 3)
    .map((split) => ({
      id: split.id,
      slug: split.id,
      name: split.name,
      days: split.days_per_week,
      lastUsed: t('custom'),
      focus: split.category || t('custom'),
      description: split.description,
      isShared: Boolean(split.is_shared),
    }))

  const recommendedSplits = splits
    .filter((s) => s.user_id === null || s.is_system)
    .filter(
      (split, index, arr) => arr.findIndex((s) => s.id === split.id) === index,
    )
    .map((split) => ({
      id: split.id,
      slug: split.id,
      name: split.name,
      days: split.days_per_week,
      lastUsed: t('system'),
      focus: split.category || t('program'),
      description: split.description,
    }))

  const latest = sessions[0] ?? null
  let lastSession = null
  if (latest) {
    const logsResult = await getSessionLiftLogs(latest.id)
    if (logsResult.error) {
      return (
        <main className="mx-auto max-w-3xl px-6 py-16">
          <PageError message={logsResult.error} />
        </main>
      )
    }
    const logs = (logsResult.data ?? []).filter((log) => !log.is_skipped)
    const byLift = new Map<
      string,
      {
        name: string
        weight: number
        reps: number
        durationSeconds?: number | null
        isCardio: boolean
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
      .map(
        (b) =>
          formatLiftLabel(
            b.name,
            b.weight,
            b.reps,
            unit,
            b.durationSeconds,
          ) ?? '',
      )
      .filter(Boolean)

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

  const historySessions = sessions.slice(0, 3).map((session) => ({
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

  return (
    <WorkoutDashboard
      displayName={displayName}
      yourSplits={yourSplits}
      recommendedSplits={recommendedSplits}
      lastSession={lastSession}
      historySessions={historySessions}
      journeyVolume={journeyVolume}
      weightUnit={unit}
      volumeTrend={volumeTrend}
      insight={insight}
      avatarUrl={profile?.avatar_url}
      profileHref={profileHref(profile?.username, userId)}
      celebrations={celebrations.map((c) => ({
        id: c.id,
        title: c.title,
        body: c.body,
      }))}
    />
  )
}
