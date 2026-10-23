import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { BODYWEIGHT_LOG_NOTE } from '@/lib/units'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type DeviceSessionLog = {
  id: string
  liftTypeId: string
  setNumber: number
  weight: number
  reps: number
  durationSeconds: number | null
  isSkipped: boolean
  loggedAt: string
  bodyweight?: boolean
}

export type DeviceSessionPayload = {
  id: string
  splitId: string
  splitDayId: string
  status: 'in_progress' | 'completed' | 'cancelled'
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
  logs: DeviceSessionLog[]
  prs: Array<{ liftTypeId: string; weight: number; reps: number }>
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function isUuid(value: string) {
  return UUID_RE.test(value)
}

function sessionTotals(logs: DeviceSessionLog[]) {
  let totalVolume = 0
  let totalSetsCompleted = 0
  let totalSetsSkipped = 0
  for (const log of logs) {
    if (log.isSkipped) {
      totalSetsSkipped += 1
      continue
    }
    totalSetsCompleted += 1
    if ((log.durationSeconds ?? 0) > 0 || log.bodyweight) continue
    totalVolume += (Number(log.weight) || 0) * (Number(log.reps) || 0)
  }
  return { totalVolume, totalSetsCompleted, totalSetsSkipped }
}

async function resolveLiftId(
  supabase: SupabaseClient,
  raw: string,
): Promise<string | null> {
  const id = raw.trim()
  if (!id) return null
  if (isUuid(id)) return id
  const slug = toSlug(id)
  const { data: bySlug } = await supabase
    .from('lift_types')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (bySlug?.id) return bySlug.id as string
  const { data: rpcId, error } = await supabase.rpc('ensure_lift_type', {
    p_slug: slug,
    p_name: id.replace(/_/g, ' '),
    p_muscle_group: null,
    p_image_url: null,
  })
  if (!error && typeof rpcId === 'string' && rpcId) return rpcId
  return null
}

function logRow(
  log: DeviceSessionLog,
  userId: string,
  sessionId: string,
  liftTypeId: string,
) {
  const isCardio = log.durationSeconds != null && Number(log.durationSeconds) > 0
  const rawWeight = Number(log.weight) || 0
  const rawReps = Number(log.reps) || 0
  const bodyweight = Boolean(log.bodyweight) && !isCardio && !log.isSkipped
  const needsPlaceholder =
    isCardio || log.isSkipped || !(rawWeight > 0) || !(rawReps > 0)
  return {
    id: log.id,
    user_id: userId,
    lift_type_id: liftTypeId,
    session_id: sessionId,
    weight: needsPlaceholder ? Math.max(rawWeight, 1) : rawWeight,
    reps: needsPlaceholder ? Math.max(rawReps, 1) : rawReps,
    duration_seconds: isCardio ? log.durationSeconds : null,
    set_number: log.setNumber,
    is_skipped: log.isSkipped,
    weight_unit: 'kg',
    logged_at: log.loggedAt,
    ...(bodyweight ? { notes: BODYWEIGHT_LOG_NOTE } : {}),
  }
}

async function upsertLogs(
  supabase: SupabaseClient,
  session: DeviceSessionPayload,
  userId: string,
  liftIds: Map<string, string>,
) {
  if (session.logs.length === 0) return
  const rows = session.logs.map((log) => {
    const liftTypeId = liftIds.get(log.liftTypeId)
    if (!liftTypeId) throw new Error('Missing lift type')
    return logRow(log, userId, session.id, liftTypeId)
  })
  const { error } = await supabase.from('lift_logs').upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

async function applyPrs(
  supabase: SupabaseClient,
  session: DeviceSessionPayload,
  userId: string,
  liftIds: Map<string, string>,
  finishedAt: string,
) {
  for (const pr of session.prs) {
    const liftTypeId = liftIds.get(pr.liftTypeId)
    if (!liftTypeId) continue
    await supabase
      .from('personal_records')
      .update({ is_current_pr: false })
      .eq('user_id', userId)
      .eq('lift_type_id', liftTypeId)
      .eq('is_current_pr', true)
    const { error } = await supabase.from('personal_records').insert({
      user_id: userId,
      lift_type_id: liftTypeId,
      lift_name: 'Lift',
      weight: pr.weight,
      reps: pr.reps,
      is_current_pr: true,
      logged_at: finishedAt,
    })
    if (error && error.code !== '23505') {
      /* A duplicate current PR is acceptable. Other errors retry with the session. */
      throw new Error(error.message)
    }
  }
}

async function syncOne(
  supabase: SupabaseClient,
  userId: string,
  session: DeviceSessionPayload,
) {
  if (!isUuid(session.id)) throw new Error('Invalid session id')
  const liftIds = new Map<string, string>()
  const rawIds = new Set<string>([
    ...session.logs.map((log) => log.liftTypeId),
    ...session.prs.map((pr) => pr.liftTypeId),
  ])
  for (const raw of rawIds) {
    const resolved = await resolveLiftId(supabase, raw)
    if (!resolved) throw new Error(`Exercise "${raw}" is not on the server yet.`)
    liftIds.set(raw, resolved)
  }

  if (session.status === 'cancelled') {
    const { data: existing } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', session.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!existing || existing.status === 'cancelled') return
    if (existing.status === 'completed') return
    await supabase.from('lift_logs').delete().eq('session_id', session.id).eq('user_id', userId)
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'cancelled',
        finished_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }

  const { data: existing } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', session.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.status === 'cancelled') {
    throw new Error('That workout was discarded and cannot be finished.')
  }

  if (session.status === 'completed') {
    if (existing?.status !== 'completed') {
      const finishedAt = session.finishedAt ?? new Date().toISOString()
      const totals = sessionTotals(session.logs)
      const { error } = await supabase.from('sessions').upsert(
        {
          id: session.id,
          user_id: userId,
          split_id: session.splitId,
          split_day_id: session.splitDayId,
          status: 'completed',
          started_at: session.startedAt,
          finished_at: finishedAt,
          duration_seconds: session.durationSeconds ?? 0,
          total_volume: totals.totalVolume,
          total_sets_completed: totals.totalSetsCompleted,
          total_sets_skipped: totals.totalSetsSkipped,
        },
        { onConflict: 'id' },
      )
      if (error) throw new Error(error.message)
      await upsertLogs(supabase, session, userId, liftIds)
      await applyPrs(supabase, session, userId, liftIds, finishedAt)
      return
    }
    await upsertLogs(supabase, session, userId, liftIds)
    await applyPrs(
      supabase,
      session,
      userId,
      liftIds,
      session.finishedAt ?? new Date().toISOString(),
    )
    return
  }

  const { error } = await supabase.from('sessions').upsert(
    {
      id: session.id,
      user_id: userId,
      split_id: session.splitId,
      split_day_id: session.splitDayId,
      status: 'in_progress',
      started_at: session.startedAt,
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(error.message)
  await upsertLogs(supabase, session, userId, liftIds)
}

export async function syncDeviceSessions(sessions: DeviceSessionPayload[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: [] as string[], failed: sessions.map((session) => session.id), unauthorized: true }
  }

  const ok: string[] = []
  const failed: string[] = []
  for (const session of sessions) {
    try {
      await syncOne(supabase, user.id, session)
      ok.push(session.id)
    } catch {
      failed.push(session.id)
    }
  }
  return { ok, failed, unauthorized: false }
}
