import { createClient } from '@/lib/supabase/client'
import { getCachedLiftTypes, getCachedUserId, refreshWorkoutCache, resolveSessionUserId } from '@/lib/offline/cache'
import { isNetworkFailure, logServerError } from '@/lib/log'
import {
  deleteLocalSession,
  getLocalSession,
  listUnsyncedSessions,
  markSessionSync,
  patchLocalSession,
  recoverStaleSyncing,
} from '@/lib/offline/session-store'
import { flushSplitMutations } from '@/lib/offline/split-store'
import { isAlreadyExistsError, upsertRows } from '@/lib/offline/rest-upsert'
import { offlineLog, offlineWarn } from '@/lib/offline/debug'
import { reconcileOutboxWithServer } from '@/lib/offline/reconcile'
import type { LocalSession } from '@/lib/offline/db'
import type { LiftType } from '@/lib/database.types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Per-step budget. Completing a session uses several steps sequentially. */
const SYNC_STEP_TIMEOUT_MS = 25_000
const sessionLocks = new Map<string, Promise<void>>()
const retryAttempt = new Map<string, number>()
const retryAfter = new Map<string, number>()

function fingerprint(session: LocalSession) {
  const logs = session.logs.map((log) => log.id).sort().join(',')
  return `${session.status}|${logs}`
}

function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = SYNC_STEP_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function sessionTotals(session: LocalSession) {
  let totalVolume = 0
  let totalSetsCompleted = 0
  let totalSetsSkipped = 0
  for (const log of session.logs) {
    if (log.isSkipped) {
      totalSetsSkipped += 1
      continue
    }
    totalSetsCompleted += 1
    if ((log.durationSeconds ?? 0) > 0) continue
    totalVolume += (Number(log.weight) || 0) * (Number(log.reps) || 0)
  }
  return { totalVolume, totalSetsCompleted, totalSetsSkipped }
}

function isTransientSyncError(err: unknown): boolean {
  if (isNetworkFailure(err)) return true
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /timed out|jwt|not signed in|invalid token|session expired|queued until|will retry|401|403|409|42501|22P02|23503|failed to fetch|jwt expired|lift type|not on the server/i.test(
    message,
  )
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function resolveLiftId(lifts: LiftType[], raw: string): string | null {
  const id = raw.trim()
  if (!id) return null
  if (UUID_RE.test(id)) return id
  const slug = toSlug(id)
  const match =
    lifts.find((row) => row.id === id) ||
    lifts.find((row) => row.slug === id) ||
    lifts.find((row) => row.slug === slug) ||
    lifts.find((row) => row.name.toLowerCase() === id.toLowerCase())
  return match?.id ?? null
}

async function loadLiftTypes(): Promise<LiftType[]> {
  const cached = await getCachedLiftTypes()
  if (cached.length > 0) return cached
  const supabase = createClient()
  const { data } = await supabase
    .from('lift_types')
    .select(
      'id, slug, name, category, sort_order, is_system, image_url, muscle_group, created_at',
    )
    .order('name', { ascending: true })
  return (data ?? []) as LiftType[]
}

async function ensureLiftId(raw: string, lifts: LiftType[]): Promise<string> {
  const resolved = resolveLiftId(lifts, raw)
  if (resolved) return resolved
  const id = raw.trim()
  if (!id) throw new Error('Set is missing a lift type.')
  const supabase = createClient()
  const slug = toSlug(id)
  const { data: rpcId, error } = await supabase.rpc('ensure_lift_type', {
    p_slug: slug,
    p_name: id.replace(/_/g, ' '),
    p_muscle_group: null,
    p_image_url: null,
  })
  if (!error && rpcId) return rpcId as string
  throw new Error(
    `Exercise "${id}" is not on the server yet. Connect once so lift types can sync, then retry.`,
  )
}

async function normalizeSession(session: LocalSession): Promise<LocalSession> {
  const lifts = await loadLiftTypes()
  const logs = await Promise.all(
    session.logs.map(async (log) => ({
      ...log,
      liftTypeId: await ensureLiftId(log.liftTypeId, lifts),
    })),
  )
  const prs = await Promise.all(
    session.prs.map(async (pr) => ({
      ...pr,
      liftTypeId: await ensureLiftId(pr.liftTypeId, lifts),
    })),
  )
  const merged = await patchLocalSession(session.id, (existing) => ({
    ...existing,
    logs,
    prs,
  }))
  return merged ?? { ...session, logs, prs }
}

async function upsertSessionRow(session: LocalSession, userId: string) {
  const supabase = createClient()
  const { data: existing, error: existingError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', session.id)
    .maybeSingle()
  if (!existingError && (existing?.status === 'completed' || existing?.status === 'cancelled')) {
    return existing.status
  }

  // Completed local workouts are written as completed in one shot via
  // finishSessionClient — never leave a bare in_progress shell behind.
  if (session.status === 'completed') {
    return existing?.status ?? null
  }

  await upsertRows('sessions', {
    id: session.id,
    user_id: userId,
    split_id: session.splitId,
    split_day_id: session.splitDayId,
    status: 'in_progress',
    started_at: session.startedAt,
  })
  return 'in_progress' as const
}

async function upsertLogs(session: LocalSession, userId: string) {
  if (session.logs.length === 0) {
    offlineWarn('sync.logs.empty', { sessionId: session.id, status: session.status })
    return
  }
  const rows = session.logs.map((log) => {
    const isCardio =
      log.durationSeconds != null && Number(log.durationSeconds) > 0
    // lift_logs requires weight > 0 and reps > 0. Skipped / empty sets need
    // placeholders or the whole batch upsert fails and finish never sticks.
    const rawWeight = Number(log.weight) || 0
    const rawReps = Number(log.reps) || 0
    const needsPlaceholder =
      isCardio || log.isSkipped || !(rawWeight > 0) || !(rawReps > 0)
    return {
      id: log.id,
      user_id: userId,
      lift_type_id: log.liftTypeId,
      session_id: session.id,
      weight: needsPlaceholder ? Math.max(rawWeight, 1) : rawWeight,
      reps: needsPlaceholder ? Math.max(rawReps, 1) : rawReps,
      duration_seconds: isCardio ? log.durationSeconds : null,
      set_number: log.setNumber,
      is_skipped: log.isSkipped,
      weight_unit: 'kg',
      logged_at: log.loggedAt,
    }
  })
  await upsertRows('lift_logs', rows)
  offlineLog('sync.logs.upserted', {
    sessionId: session.id,
    count: rows.length,
  })
}

/**
 * Finish a completed local session entirely over browser REST (same auth as
 * upsertRows). Do NOT use finishSessionAction here — that server action runs
 * on the Next.js process and can fail (DNS/cookie/auth) after the browser
 * already created an in_progress shell, leaving a zombie workout.
 */
async function finishSessionClient(
  session: LocalSession,
  userId: string,
): Promise<void> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', session.id)
    .maybeSingle()

  if (existing?.status === 'completed') {
    // Heal sets / PRs that never landed on a prior partial sync.
    if (session.logs.length > 0) {
      await upsertLogs(session, userId)
    }
    const finishedAt = session.finishedAt ?? new Date().toISOString()
    await applySessionPersonalRecords(session, userId, finishedAt)
    offlineLog('sync.finish.already-completed', { sessionId: session.id })
    return
  }
  if (existing?.status === 'cancelled') {
    throw new Error('That workout was discarded and cannot be finished.')
  }

  const finishedAt = session.finishedAt ?? new Date().toISOString()
  const { totalVolume, totalSetsCompleted, totalSetsSkipped } =
    sessionTotals(session)

  // Ensure the session row exists, then mark completed with totals from local logs.
  await upsertRows('sessions', {
    id: session.id,
    user_id: userId,
    split_id: session.splitId,
    split_day_id: session.splitDayId,
    status: 'completed',
    started_at: session.startedAt,
    finished_at: finishedAt,
    duration_seconds: session.durationSeconds ?? 0,
    total_volume: totalVolume,
    total_sets_completed: totalSetsCompleted,
    total_sets_skipped: totalSetsSkipped,
  })

  // Logs after the session row so FK session_id is valid. Retry-safe upsert.
  await upsertLogs(session, userId)

  // PRs are best-effort — never block completing the workout.
  await applySessionPersonalRecords(session, userId, finishedAt)

  const { data: verify } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', session.id)
    .maybeSingle()
  if (verify?.status !== 'completed') {
    throw new Error('Session finish did not stick on the server — will retry.')
  }

  // Confirm logs landed (empty local logs already warned above).
  if (session.logs.length > 0) {
    const { count, error: countError } = await supabase
      .from('lift_logs')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('user_id', userId)
    if (countError) {
      throw new Error(`Could not verify synced sets: ${countError.message}`)
    }
    if ((count ?? 0) < session.logs.length) {
      throw new Error(
        `Only ${count ?? 0}/${session.logs.length} sets reached the server — will retry.`,
      )
    }
  }

  offlineLog('sync.finish.client', {
    sessionId: session.id,
    logs: session.logs.length,
    totalVolume,
    totalSetsCompleted,
  })
}

/**
 * Idempotent PR write for finish sync.
 *
 * Race (multi-tab / overlapping finish retries, no unique constraint on
 * is_current_pr): two callers both demote then both insert → multiple
 * is_current_pr=true rows for the same lift.
 *
 * Strategy: if a current row already matches weight/reps, keep it and demote
 * extras; otherwise demote all currents, insert one, then demote any other
 * currents that appeared concurrently (keep the inserted id).
 */
export async function applySessionPersonalRecords(
  session: LocalSession,
  userId: string,
  finishedAt: string,
  client: ReturnType<typeof createClient> = createClient(),
): Promise<{ applied: number; skipped: number; cleaned: number }> {
  let applied = 0
  let skipped = 0
  let cleaned = 0
  if (session.prs.length === 0) {
    return { applied, skipped, cleaned }
  }

  try {
    for (const pr of session.prs) {
      const { data: currents, error: readError } = await client
        .from('personal_records')
        .select('id, weight, reps')
        .eq('user_id', userId)
        .eq('lift_type_id', pr.liftTypeId)
        .eq('is_current_pr', true)

      if (readError) {
        offlineWarn('sync.pr.read-failed', {
          sessionId: session.id,
          liftTypeId: pr.liftTypeId,
          message: readError.message,
        })
        continue
      }

      const match = (currents ?? []).find(
        (row) =>
          Number(row.weight) === Number(pr.weight) &&
          Number(row.reps) === Number(pr.reps),
      )

      if (match) {
        skipped += 1
        const extras = (currents ?? []).filter((row) => row.id !== match.id)
        if (extras.length > 0) {
          const { error: cleanError } = await client
            .from('personal_records')
            .update({ is_current_pr: false })
            .eq('user_id', userId)
            .eq('lift_type_id', pr.liftTypeId)
            .eq('is_current_pr', true)
            .neq('id', match.id)
          if (!cleanError) cleaned += extras.length
        }
        continue
      }

      await client
        .from('personal_records')
        .update({ is_current_pr: false })
        .eq('user_id', userId)
        .eq('lift_type_id', pr.liftTypeId)
        .eq('is_current_pr', true)

      const { data: inserted, error: insertError } = await client
        .from('personal_records')
        .insert({
          user_id: userId,
          lift_type_id: pr.liftTypeId,
          lift_name: 'Lift',
          weight: pr.weight,
          reps: pr.reps,
          is_current_pr: true,
          logged_at: finishedAt,
        })
        .select('id')
        .maybeSingle()

      if (insertError && !isAlreadyExistsError(insertError)) {
        offlineWarn('sync.pr.failed', {
          sessionId: session.id,
          liftTypeId: pr.liftTypeId,
          message: insertError.message,
        })
        continue
      }

      if (inserted?.id) {
        applied += 1
        const { data: after } = await client
          .from('personal_records')
          .select('id')
          .eq('user_id', userId)
          .eq('lift_type_id', pr.liftTypeId)
          .eq('is_current_pr', true)
        const rivals = (after ?? []).filter((row) => row.id !== inserted.id)
        if (rivals.length > 0) {
          const { error: raceCleanError } = await client
            .from('personal_records')
            .update({ is_current_pr: false })
            .eq('user_id', userId)
            .eq('lift_type_id', pr.liftTypeId)
            .eq('is_current_pr', true)
            .neq('id', inserted.id)
          if (!raceCleanError) cleaned += rivals.length
        }
      }
    }
  } catch (err) {
    offlineWarn('sync.pr.failed', {
      sessionId: session.id,
      message: err instanceof Error ? err.message : String(err),
    })
  }

  return { applied, skipped, cleaned }
}

export async function syncLocalSession(
  sessionId: string,
  userId?: string,
  depth = 0,
): Promise<void> {
  const session = await getLocalSession(sessionId)
  if (!session || session.syncStatus === 'synced') {
    offlineLog('sync.skip', {
      sessionId,
      reason: !session ? 'missing' : 'already-synced',
    })
    return
  }

  const uid =
    userId ||
    session.userId ||
    (await resolveSessionUserId().catch(() => null)) ||
    (await getCachedUserId().catch(() => null))
  if (!uid) {
    offlineWarn('sync.defer.no-user', { sessionId })
    await markSessionSync(session.id, 'pending', 'Waiting to reconnect before sync.')
    return
  }

  offlineLog('sync.attempt', {
    sessionId,
    userId: uid,
    status: session.status,
    logs: session.logs.length,
    depth,
  })

  await markSessionSync(session.id, 'syncing')

  try {
    const normalized = await normalizeSession({
      ...((await getLocalSession(session.id)) ?? session),
      syncStatus: 'syncing',
    })
    const before = fingerprint(normalized)

    if (normalized.status === 'cancelled') {
      await withTimeout(
        (async () => {
          const { discardSessionAction } = await import('@/lib/data/session-actions')
          await discardSessionAction(normalized.id)
          await deleteLocalSession(normalized.id)
        })(),
        `Cancel ${sessionId.slice(0, 8)}`,
      )
      retryAttempt.delete(sessionId)
      retryAfter.delete(sessionId)
      offlineLog('sync.result', { sessionId, ok: true, userId: uid, status: 'cancelled' })
      return
    }

    if (normalized.status === 'completed') {
      // Single client-side path: session row + logs + completed status.
      // Never call finishSessionAction from offline sync (server-action gap).
      await withTimeout(
        finishSessionClient(normalized, uid),
        `Finish ${sessionId.slice(0, 8)}`,
        SYNC_STEP_TIMEOUT_MS * 2,
      )
    } else {
      await withTimeout(
        (async () => {
          await upsertSessionRow(normalized, uid)
          await upsertLogs(normalized, uid)
        })(),
        `Session ${sessionId.slice(0, 8)}`,
      )
    }

    const after = await getLocalSession(normalized.id)
    if (after && fingerprint(after) !== before) {
      await markSessionSync(normalized.id, 'pending')
      if (depth < 8) return syncLocalSession(normalized.id, uid, depth + 1)
      return
    }
    retryAttempt.delete(sessionId)
    retryAfter.delete(sessionId)
    await markSessionSync(normalized.id, 'synced')
    offlineLog('sync.result', {
      sessionId,
      ok: true,
      userId: uid,
      status: normalized.status,
      logs: normalized.logs.length,
    })
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      // 409 on an upsert must not mark a completed local session synced unless
      // the server row is already completed — otherwise finish never runs.
      const local = await getLocalSession(sessionId)
      if (local?.status === 'completed') {
        const supabase = createClient()
        const { data } = await supabase
          .from('sessions')
          .select('id, status')
          .eq('id', sessionId)
          .maybeSingle()
        if (data?.status !== 'completed') {
          await markSessionSync(sessionId, 'pending', 'Waiting to finish on server.')
          offlineWarn('sync.result', {
            sessionId,
            ok: false,
            status: 'pending',
            message: 'duplicate without completed server row',
          })
          throw err
        }
        retryAttempt.delete(sessionId)
        retryAfter.delete(sessionId)
        await markSessionSync(sessionId, 'synced')
        offlineLog('sync.result', { sessionId, ok: true, reason: 'already-exists' })
        return
      }
      // in_progress / cancelled: duplicate shell is not proof of full sync.
      await markSessionSync(sessionId, 'pending', null)
      offlineWarn('sync.result', {
        sessionId,
        ok: false,
        status: 'pending',
        message: 'duplicate while session still open',
      })
      return
    }
    const message = err instanceof Error ? err.message : 'Sync failed'
    const attempt = (retryAttempt.get(sessionId) ?? 0) + 1
    retryAttempt.set(sessionId, attempt)
    const delay = Math.min(8_000 * 2 ** Math.min(attempt - 1, 5), 5 * 60_000)
    retryAfter.set(sessionId, Date.now() + delay)
    const status = isTransientSyncError(err) ? 'pending' : 'error'
    await markSessionSync(sessionId, status, message)
    offlineWarn('sync.result', { sessionId, ok: false, status, message, attempt })
    throw err
  }
}

function enqueueSessionSync(sessionId: string, userId?: string) {
  const previous = sessionLocks.get(sessionId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(() => syncLocalSession(sessionId, userId))
  sessionLocks.set(sessionId, next.then(() => undefined, () => undefined))
  return next
}

export type FlushResult = {
  synced: number
  failed: number
  errors: string[]
}

let flushPromise: Promise<FlushResult> | null = null

async function flushOfflineQueueInner(): Promise<FlushResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    offlineLog('sync.flush.skip', { reason: 'offline' })
    return { synced: 0, failed: 0, errors: [] }
  }

  await recoverStaleSyncing()
  await reconcileOutboxWithServer()

  let splitFlush = { synced: 0, failed: 0 }
  try {
    splitFlush = await flushSplitMutations()
  } catch (err) {
    splitFlush = { synced: 0, failed: 1 }
    if (!isNetworkFailure(err)) logServerError('[offline-sync] splits', err)
  }

  const pending = await listUnsyncedSessions()
  const now = Date.now()
  const due = pending.filter((row) => (retryAfter.get(row.id) ?? 0) <= now)
  const uid = (await getCachedUserId().catch(() => null)) ?? undefined
  offlineLog('sync.flush.start', {
    pending: pending.length,
    due: due.length,
    userId: uid ?? null,
  })

  const errors: string[] = []
  let synced = splitFlush.synced
  let failed = splitFlush.failed

  for (const session of due) {
    try {
      await enqueueSessionSync(session.id, uid)
      const row = await getLocalSession(session.id)
      if (row?.syncStatus === 'synced') synced += 1
      else if (row?.syncError) {
        failed += 1
        errors.push(row.syncError)
      }
    } catch (reason) {
      failed += 1
      const message =
        reason instanceof Error ? reason.message : 'Sync failed'
      errors.push(message)
      if (!isNetworkFailure(reason)) {
        logServerError('[offline-sync]', reason)
      }
    }
  }

  for (const skipped of pending.filter((row) => !due.some((d) => d.id === row.id))) {
    if (skipped.syncError) errors.push(skipped.syncError)
  }

  await reconcileOutboxWithServer()

  if (synced > 0) {
    await refreshWorkoutCache().catch(() => false)
    await import('@/lib/offline/offline-splits')
      .then(({ refreshPinnedSplits }) => refreshPinnedSplits())
      .catch(() => 0)
  }

  offlineLog('sync.flush.result', { synced, failed, errors: errors.slice(0, 3) })
  return { synced, failed, errors }
}

export async function flushOfflineQueue(): Promise<FlushResult> {
  if (flushPromise) return flushPromise
  flushPromise = flushOfflineQueueInner().finally(() => {
    flushPromise = null
  })
  return flushPromise
}

/** Fire-and-forget: sync queued splits if online. */
export function queueSplitSync() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  void flushSplitMutations().catch((err) => {
    logServerError('[offline-sync] splits', err)
  })
}

/** Fire-and-forget: sync one session if online, otherwise leave queued. */
export function queueSessionSync(session: LocalSession) {
  void awaitSessionSync(session).catch((err) => {
    offlineWarn('sync.trigger.failed', {
      id: session.id,
      message: err instanceof Error ? err.message : String(err),
    })
    logServerError('[offline-sync] background', err)
  })
}

/** Awaitable sync so Finish/Discard can persist before navigation. */
export async function awaitSessionSync(session: LocalSession): Promise<void> {
  const online = typeof navigator === 'undefined' || navigator.onLine
  offlineLog('sync.trigger', {
    id: session.id,
    online,
    status: session.status,
    syncStatus: session.syncStatus,
    logs: session.logs.length,
  })
  if (!online) return
  retryAfter.delete(session.id)
  await enqueueSessionSync(session.id)
}

/** Manual retry ignores backoff so stuck items run immediately.
 * Do NOT clear sessionLocks — that drops the per-session mutex and allows
 * overlapping syncLocalSession runs (duplicate finish / torn syncStatus).
 */
export function retryOfflineQueueNow() {
  retryAfter.clear()
}
