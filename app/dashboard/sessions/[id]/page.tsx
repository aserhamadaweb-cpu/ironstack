import { notFound, redirect } from 'next/navigation'
import { PageError } from '@/components/page-states'
import { SessionDetailView } from '@/components/session-detail-view'
import { LocalSessionDetailFallback } from '@/components/local-session-detail'
import {
  getProfile,
  getSessionById,
  getSessionLiftLogs,
} from '@/lib/data/queries'
import { isCardioCategory } from '@/lib/units'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  return {
    title: 'Session Detail — IRONSTACK',
    description: `Details for training session ${id}`,
  }
}

export default async function SessionDetailPage({ params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [sessionResult, profileResult, logsResult] = await Promise.all([
    getSessionById(user.id, id),
    getProfile(user.id),
    getSessionLiftLogs(id),
  ])

  const error =
    sessionResult.error || profileResult.error || logsResult.error
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={error} />
      </main>
    )
  }

  const session = sessionResult.data
  if (!session) {
    return (
      <LocalSessionDetailFallback
        id={id}
        displayName={
          profileResult.data?.display_name ||
          user.email?.split('@')[0] ||
          'Athlete'
        }
        initials={initialsFrom(
          profileResult.data?.display_name ||
            user.email?.split('@')[0] ||
            'Athlete',
        )}
        weightUnit={profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'}
      />
    )
  }

  // Only the owner should see this — getSessionById already filters by user_id.
  if (session.user_id !== user.id) {
    notFound()
  }

  const logs = logsResult.data ?? []

  // Prefer live totals from logs when session aggregates were zeroed by older bugs.
  let volumeFromLogs = 0
  let completedFromLogs = 0
  let skippedFromLogs = 0
  for (const log of logs) {
    if (log.is_skipped) {
      skippedFromLogs += 1
      continue
    }
    completedFromLogs += 1
    const duration = Number(log.duration_seconds) || 0
    if (duration > 0) continue
    volumeFromLogs += (Number(log.weight) || 0) * (Number(log.reps) || 0)
  }

  const totalVolume =
    Number(session.total_volume) > 0
      ? Number(session.total_volume)
      : volumeFromLogs
  const setsCompleted =
    (session.total_sets_completed ?? 0) > 0
      ? (session.total_sets_completed ?? 0)
      : completedFromLogs
  const setsSkipped =
    (session.total_sets_skipped ?? 0) > 0
      ? (session.total_sets_skipped ?? 0)
      : skippedFromLogs

  const byLift = new Map<
    string,
    {
      name: string
      isCardio: boolean
      sets: Array<{
        setNumber: number
        weight: number
        reps: number
        durationSeconds?: number | null
        skipped: boolean
      }>
    }
  >()

  for (const log of logs) {
    const name = log.lift_types?.name ?? 'Lift'
    const isCardio =
      isCardioCategory(log.lift_types?.category) ||
      (Number(log.duration_seconds) || 0) > 0
    const key = log.lift_type_id
    const current = byLift.get(key) ?? { name, isCardio, sets: [] }
    current.sets.push({
      setNumber: log.set_number ?? current.sets.length + 1,
      weight: Number(log.weight) || 0,
      reps: Number(log.reps) || 0,
      durationSeconds: log.duration_seconds,
      skipped: Boolean(log.is_skipped),
    })
    byLift.set(key, current)
  }

  const lifts = [...byLift.values()].map((lift) => ({
    ...lift,
    sets: [...lift.sets].sort((a, b) => a.setNumber - b.setNumber),
  }))

  const dayName = session.split_days?.name ?? 'Day'
  const splitName = session.splits?.name ?? 'Split'
  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <SessionDetailView
      displayName={displayName}
      initials={initialsFrom(displayName)}
      avatarUrl={profileResult.data?.avatar_url}
      title={`${dayName} • ${splitName}`}
      finishedAt={session.finished_at ?? session.started_at}
      durationSeconds={session.duration_seconds ?? 0}
      totalVolume={totalVolume}
      setsCompleted={setsCompleted}
      setsSkipped={setsSkipped}
      lifts={lifts}
      weightUnit={
        profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'
      }
      backHref="/dashboard/history"
      backLabel="BACK TO HISTORY"
    />
  )
}
