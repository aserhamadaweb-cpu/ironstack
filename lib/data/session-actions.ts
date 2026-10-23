'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getAuthIdentity } from '@/lib/supabase/server'
import type { PersonalRecord, Session } from '@/lib/database.types'
import { isAlreadyExistsError } from '@/lib/offline/duplicate-error'
import { logServerError } from '@/lib/log'

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
  sessionId?: string
  startedAt?: string
}): Promise<ActionResult<Session>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to start a session.')

  const sessionId = input.sessionId ?? crypto.randomUUID()
  const startedAt = input.startedAt ?? new Date().toISOString()

  const { data: existing } = await supabase
    .from('sessions')
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
    )
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return { data: existing as Session, error: null }
  }

  await supabase
    .from('sessions')
    .update({
      status: 'cancelled',
      finished_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .neq('id', sessionId)

  const { data, error } = await supabase
    .from('sessions')
    .upsert(
      {
        id: sessionId,
        user_id: user.id,
        split_id: input.splitId,
        split_day_id: input.splitDayId,
        status: 'in_progress',
        started_at: startedAt,
      },
      { onConflict: 'id', ignoreDuplicates: false },
    )
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
    )
    .single()

  if (error || !data) {
    if (isAlreadyExistsError(error)) {
      const { data: again } = await supabase
        .from('sessions')
        .select(
          'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
        )
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (again) return { data: again as Session, error: null }
    }
    return fail('Could not start the session. Please try again.', error?.message)
  }
  return { data: data as Session, error: null }
}

export async function logSetAction(input: {
  sessionId: string
  liftTypeId: string
  setNumber: number
  isSkipped: boolean
  logId?: string
  loggedAt?: string
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

  const logId = input.logId ?? crypto.randomUUID()

  const { data, error } = await supabase
    .from('lift_logs')
    .upsert(
      {
        id: logId,
        user_id: user.id,
        lift_type_id: input.liftTypeId,
        session_id: input.sessionId,
        weight,
        reps,
        duration_seconds: isCardio ? durationSeconds : null,
        set_number: input.setNumber,
        is_skipped: Boolean(input.isSkipped),
        weight_unit: 'kg',
        logged_at: input.loggedAt ?? new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (error || !data) {
    if (isAlreadyExistsError(error) && logId) {
      return { data: { id: logId }, error: null }
    }
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
  const { userId } = await getAuthIdentity()
  if (!userId) return fail('You must be signed in to finish a session.')
  const user = { id: userId }

  const { data: existing } = await supabase
    .from('sessions')
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
    )
    .eq('id', input.sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.status === 'completed') {
    return { data: existing as Session, celebrations: [], error: null }
  }
  if (existing?.status === 'cancelled') {
    return fail('That workout was discarded and cannot be finished.')
  }

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

  // Write PRs before marking the session completed so a PR failure never leaves
  // a finished session without updated personal_records.
  const celebrationPrs: Array<{ liftName: string; weight: number; reps: number }> =
    []

  const liftNameById = new Map<string, string>()
  if (input.prs.length > 0) {
    const liftTypeIds = [...new Set(input.prs.map((pr) => pr.liftTypeId))]
    const { data: liftRows, error: liftFetchError } = await supabase
      .from('lift_types')
      .select('id, name')
      .in('id', liftTypeIds)

    if (liftFetchError) {
      return fail(
        'Could not load lift types for your personal records. Please try again.',
        liftFetchError.message,
      )
    }

    for (const lift of liftRows ?? []) {
      liftNameById.set(lift.id as string, (lift.name as string) || 'Lift')
    }
  }

  for (const pr of input.prs) {
    const demoteQuery = pr.previousRecordId
      ? supabase
          .from('personal_records')
          .update({ is_current_pr: false })
          .eq('id', pr.previousRecordId)
          .eq('user_id', user.id)
      : supabase
          .from('personal_records')
          .update({ is_current_pr: false })
          .eq('user_id', user.id)
          .eq('lift_type_id', pr.liftTypeId)
          .eq('is_current_pr', true)

    const { data: demoted, error: demoteError } = await demoteQuery.select('id')

    if (demoteError) {
      logServerError('[session-actions] demote previous PR failed', demoteError)
      return fail(
        'Could not update your previous personal record. Please try again.',
        demoteError.message,
      )
    }

    if (pr.previousRecordId && (!demoted || demoted.length === 0)) {
      logServerError('[session-actions] demote previous PR: no rows updated', {
        previousRecordId: pr.previousRecordId,
        liftTypeId: pr.liftTypeId,
      })
      return fail(
        'Could not update your previous personal record. Please try again.',
        'No matching PR row was updated.',
      )
    }

    const liftName = liftNameById.get(pr.liftTypeId) ?? 'Lift'
    const { error: insertError } = await supabase.from('personal_records').insert({
      user_id: user.id,
      lift_type_id: pr.liftTypeId,
      lift_name: liftName,
      weight: pr.weight,
      reps: pr.reps,
      is_current_pr: true,
      logged_at: finishedAt,
    })

    if (insertError) {
      logServerError('[session-actions] insert new PR failed', insertError)
      return fail(
        'Could not save your new personal record. Please try again.',
        insertError.message,
      )
    }

    celebrationPrs.push({
      liftName,
      weight: pr.weight,
      reps: pr.reps,
    })
  }

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
    .eq('status', 'in_progress')
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
    )
    .maybeSingle()

  if (error) {
    return fail(
      error.message || 'Could not finish the session. Please try again.',
      error.message,
    )
  }

  if (!data) {
    const { data: again } = await supabase
      .from('sessions')
      .select(
        'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at',
      )
      .eq('id', input.sessionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (again?.status === 'completed') {
      return { data: again as Session, celebrations: [], error: null }
    }
    return fail('Could not finish the session. Please try again.')
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
  revalidatePath('/dashboard/history')

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

export async function getActiveSessionAction(): Promise<
  ActionResult<{
    id: string
    splitId: string
    splitDayId: string
    startedAt: string
    splitName: string | null
    dayName: string | null
  } | null>
> {
  const { userId } = await getAuthIdentity()
  if (!userId) return { data: null, error: null }
  const { getInProgressSession } = await import('@/lib/data/queries')
  const result = await getInProgressSession(userId)
  if (result.error) return { data: null, error: result.error }
  return { data: result.data, error: null }
}

export async function discardSessionAction(
  sessionId: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { userId } = await getAuthIdentity()
  if (!userId) return fail('You must be signed in to discard a session.')

  const id = sessionId.trim()
  if (!id) return fail('Missing session id.')

  const { data: pending } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'in_progress')

  const ids = new Set((pending ?? []).map((row) => row.id as string))
  ids.add(id)

  for (const pendingId of ids) {
    const { data: existing } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', pendingId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existing) continue
    if (existing.status === 'completed') {
      if (pendingId === id && ids.size === 1) {
        return fail('That workout is already finished and cannot be discarded.')
      }
      continue
    }

    await supabase.from('lift_logs').delete().eq('session_id', pendingId).eq('user_id', userId)

    const { data: cancelled, error: cancelError } = await supabase
      .from('sessions')
      .update({
        status: 'cancelled',
        finished_at: new Date().toISOString(),
      })
      .eq('id', pendingId)
      .eq('user_id', userId)
      .neq('status', 'completed')
      .select('id, status')
      .maybeSingle()

    if (cancelError || cancelled?.status !== 'cancelled') {
      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', pendingId)
        .eq('user_id', userId)
        .neq('status', 'completed')
      if (deleteError) {
        return fail(
          'Could not discard that session. Please try again.',
          deleteError.message,
        )
      }
    }
  }

  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/home')
  revalidatePath('/dashboard/history')
  return { data: { id }, error: null }
}
