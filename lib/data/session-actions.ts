'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PersonalRecord, Session } from '@/lib/database.types'

export type ActionResult<T = null> =
  | { data: T; error: null }
  | { data: null; error: string }

function fail(message: string, detail?: string): ActionResult<never> {
  console.error('[session-actions]', message, detail)
  return { data: null, error: message }
}

export async function startSessionAction(input: {
  splitId: string
  splitDayId: string
}): Promise<ActionResult<Session>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to start a session.')

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      split_id: input.splitId,
      split_day_id: input.splitDayId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
    )
    .single()

  if (error || !data) {
    return fail('Could not start the session. Please try again.', error?.message)
  }
  return { data: data as Session, error: null }
}

export async function logSetAction(input: {
  sessionId: string
  liftTypeId: string
  setNumber: number
  isSkipped: boolean
  /** Strength — required unless durationSeconds is set. */
  weight?: number
  reps?: number
  /** Cardio — stored as seconds on lift_logs.duration_seconds. */
  durationSeconds?: number
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to log a set.')

  const durationSeconds =
    input.durationSeconds != null ? Number(input.durationSeconds) : null
  const isCardio = durationSeconds != null && durationSeconds > 0

  let weight = 0
  let reps = 0

  if (isCardio) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return fail('Duration is required to log cardio.')
    }
    // lift_logs still requires weight > 0 and reps > 0 — real cardio data
    // lives in duration_seconds; these are harmless placeholders.
    weight = 1
    reps = 1
  } else {
    weight = Number(input.weight)
    reps = Number(input.reps)
    if (!(weight > 0) || !(reps > 0)) {
      return fail('Weight and reps are required to log a set.')
    }
  }

  const { data, error } = await supabase
    .from('lift_logs')
    .insert({
      user_id: user.id,
      lift_type_id: input.liftTypeId,
      session_id: input.sessionId,
      weight,
      reps,
      duration_seconds: isCardio ? durationSeconds : null,
      set_number: input.setNumber,
      is_skipped: Boolean(input.isSkipped),
      weight_unit: 'kg',
      logged_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    return fail('Could not save that set. Please try again.', error?.message)
  }
  return { data: { id: data.id as string }, error: null }
}

export async function finishSessionAction(input: {
  sessionId: string
  durationSeconds: number
  /** New PRs to upsert into personal_records. */
  prs: Array<{
    liftTypeId: string
    weight: number
    reps: number
    previousRecordId?: string | null
  }>
}): Promise<
  ActionResult<Session> & {
    celebrations?: Array<{ id: string; title: string; body: string | null }>
  }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to finish a session.')

  // Source of truth: recompute totals from the session's lift_logs rows.
  const { data: logs, error: logsError } = await supabase
    .from('lift_logs')
    .select('weight, reps, duration_seconds, is_skipped')
    .eq('session_id', input.sessionId)
    .eq('user_id', user.id)

  if (logsError) {
    return fail('Could not load sets for this session.', logsError.message)
  }

  let totalVolume = 0
  let totalSetsCompleted = 0
  let totalSetsSkipped = 0
  for (const log of logs ?? []) {
    if (log.is_skipped) {
      totalSetsSkipped += 1
      continue
    }
    totalSetsCompleted += 1
    const duration = Number(log.duration_seconds) || 0
    if (duration > 0) continue
    totalVolume += (Number(log.weight) || 0) * (Number(log.reps) || 0)
  }

  const finishedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      finished_at: finishedAt,
      duration_seconds: input.durationSeconds,
      total_volume: totalVolume,
      total_sets_completed: totalSetsCompleted,
      total_sets_skipped: totalSetsSkipped,
    })
    .eq('id', input.sessionId)
    .eq('user_id', user.id)
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
    )
    .single()

  if (error || !data) {
    return fail('Could not finish the session. Please try again.', error?.message)
  }

  // Upsert personal_records for any new PRs hit this session.
  const celebrationPrs: Array<{ liftName: string; weight: number; reps: number }> =
    []

  for (const pr of input.prs) {
    if (pr.previousRecordId) {
      await supabase
        .from('personal_records')
        .update({ is_current_pr: false })
        .eq('id', pr.previousRecordId)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('personal_records')
        .update({ is_current_pr: false })
        .eq('user_id', user.id)
        .eq('lift_type_id', pr.liftTypeId)
        .eq('is_current_pr', true)
    }

    await supabase.from('personal_records').insert({
      user_id: user.id,
      lift_type_id: pr.liftTypeId,
      weight: pr.weight,
      reps: pr.reps,
      is_current_pr: true,
      logged_at: finishedAt,
    })

    const { data: lift } = await supabase
      .from('lift_types')
      .select('name')
      .eq('id', pr.liftTypeId)
      .maybeSingle()

    celebrationPrs.push({
      liftName: lift?.name ?? 'Lift',
      weight: pr.weight,
      reps: pr.reps,
    })
  }

  let celebrations: Array<{ id: string; title: string; body: string | null }> =
    []

  if (celebrationPrs.length > 0) {
    const { createPrCelebrations } = await import('@/lib/ai/celebrations')
    const row = await createPrCelebrations({
      userId: user.id,
      sessionId: input.sessionId,
      prs: celebrationPrs,
    })
    if (row) {
      celebrations = [{ id: row.id, title: row.title, body: row.body }]
    }
  }

  try {
    const { getOrRefreshCoachInsight } = await import('@/lib/ai/insights')
    await getOrRefreshCoachInsight(user.id)
  } catch (err) {
    console.error('[session] insight refresh failed', err)
  }

  // Refresh Workout / Home / Profile so Your Journey and related stats update.
  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/home')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/ai-coach')

  return { data: data as Session, celebrations, error: null }
}

export async function getCurrentPrsAction(
  liftTypeIds: string[],
): Promise<ActionResult<PersonalRecord[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Not signed in.')

  if (liftTypeIds.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('personal_records')
    .select('id, user_id, lift_type_id, weight, reps, is_current_pr, logged_at')
    .eq('user_id', user.id)
    .eq('is_current_pr', true)
    .in('lift_type_id', liftTypeIds)

  if (error) {
    return fail('Could not load personal records.', error.message)
  }
  return { data: (data ?? []) as PersonalRecord[], error: null }
}
