import { createClient } from '@/lib/supabase/server'
import {
  formatRelativeFinishedAt,
  formatSessionDate,
  formatVolume,
} from '@/lib/session-store'
import { formatDurationSeconds, isCardioCategory } from '@/lib/units'

export type SessionSummaryData = {
  badge: string
  meta: string
  title: string
  blurb: string
  duration: string
  volume: string
  sets: string
  standouts: string[]
}

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Build Last-Session-Summary payload for any completed public session. */
export async function buildSessionSummary(
  sessionId: string,
): Promise<{ data: SessionSummaryData | null; error: string | null }> {
  const supabase = await createClient()
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(
      'id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, splits(id, name), split_days(id, name)',
    )
    .eq('id', sessionId)
    .eq('status', 'completed')
    .maybeSingle()

  if (sessionError) {
    return { data: null, error: sessionError.message }
  }
  if (!session) {
    return { data: null, error: 'Session not found.' }
  }

  const { data: logs, error: logsError } = await supabase
    .from('lift_logs')
    .select(
      'lift_type_id, weight, reps, duration_seconds, is_skipped, lift_types(id, name, category)',
    )
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true })

  if (logsError) {
    return { data: null, error: logsError.message }
  }

  type LogRow = {
    lift_type_id: string
    weight: number
    reps: number
    duration_seconds: number | null
    is_skipped: boolean | null
    lift_types:
      | { id: string; name: string; category?: string }
      | { id: string; name: string; category?: string }[]
      | null
  }

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
  for (const log of (logs ?? []) as LogRow[]) {
    if (log.is_skipped) continue
    const lift = oneRelation(log.lift_types)
    const name = lift?.name ?? 'Lift'
    const isCardio =
      isCardioCategory(lift?.category) ||
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

    const weight = Number(log.weight) || 0
    if (!current || weight > current.weight) {
      byLift.set(log.lift_type_id, {
        name,
        weight,
        reps: Number(log.reps) || 0,
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
    .slice(0, 8)
    .map((b) =>
      b.isCardio
        ? `${b.name} — ${formatDurationSeconds(b.durationSeconds)}`
        : `${b.name} — ${b.weight}kg × ${b.reps}`,
    )

  const durationSec = session.duration_seconds ?? 0
  const minutes = Math.max(0, Math.round(durationSec / 60))
  const durationLabel =
    durationSec >= 3600
      ? `${Math.floor(durationSec / 3600)}h ${Math.round((durationSec % 3600) / 60)}m`
      : `${Math.max(1, minutes)}m`

  const finishedAt = session.finished_at ?? session.started_at
  const split = oneRelation(
    session.splits as { name?: string } | { name?: string }[] | null,
  )
  const day = oneRelation(
    session.split_days as { name?: string } | { name?: string }[] | null,
  )

  return {
    data: {
      badge: formatRelativeFinishedAt(finishedAt),
      meta: `${formatSessionDate(finishedAt)} · ${durationLabel}`,
      title: `${day?.name ?? 'Day'} • ${split?.name ?? 'Split'}`,
      blurb: 'Logged and locked in — every session compounds.',
      duration: durationLabel,
      volume: formatVolume(Number(session.total_volume) || 0),
      sets: String(session.total_sets_completed ?? 0),
      standouts,
    },
    error: null,
  }
}
