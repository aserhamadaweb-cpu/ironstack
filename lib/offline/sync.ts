import { createClient } from '@/lib/supabase/client'
import { finishSessionAction } from '@/lib/data/session-actions'
import { getCachedLiftTypes, getCachedUserId, refreshWorkoutCache, resolveSessionUserId } from '@/lib/offline/cache'
import { isNetworkFailure, logServerError } from '@/lib/log'
import {
  deleteLocalSession,
  getLocalSession,
  listUnsyncedSessions,
  markSessionSync,
  putLocalSession,
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

const SYNC_TIMEOUT_MS = 20_000
const sessionLocks = new Map<string, Promise<void>>()
const retryAttempt = new Map<string, number>()
const retryAfter = new Map<string, number>()

function fingerprint(session: LocalSession) {
  const logs = session.logs.map((log) => log.id).sort().join(',')
  return `${session.status}|${logs}`
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out`)),
      SYNC_TIMEOUT_MS,
    )
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
  const next = { ...session, logs, prs }
  await putLocalSession(next)
  return next
}

async function upsertSessionRow(session: LocalSession, userId: string) {
  const supabase = createClient()
  const { data: existing, error: existingError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', session.id)
    .maybeSingle()
  if (!existingError && (existing?.status === 'completed' || existing?.status === 'cancelled')) {
    return
  }

  // Never write in_progress over a completed local session that already exists
  // on the server. A missing row still needs an in_progress insert so finish
  // can mark it completed.
  if (session.status === 'completed' && existing) return

  await upsertRows('sessions', {
    id: session.id,
    user_id: userId,
    split_id: session.splitId,
    split_day_id: session.splitDayId,
    status: 'in_progress',
    started_at: session.startedAt,
  })
}

async function upsertLogs(session: LocalSession, userId: string) {
  if (session.logs.length === 0) return
  const rows = session.logs.map((log) => {
    const isCardio =
      log.durationSeconds != null && Number(log.durationSeconds) > 0
    return {
      id: log.id,
      user_id: userId,
      lift_type_id: log.liftTypeId,
      session_id: session.id,
      weight: isCardio ? 1 : log.weight,
      reps: isCardio ? 1 : log.reps,
      duration_seconds: isCardio ? log.durationSeconds : null,
      set_number: log.setNumber,
      is_skipped: log.isSkipped,
      weight_unit: 'kg',
      logged_at: log.loggedAt,
    }
  })
  await upsertRows('lift_logs', rows)
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

    await withTimeout(
      (async () => {
        if (normalized.status === 'cancelled') {
          const { discardSessionAction } = await import('@/lib/data/session-actions')
          await discardSessionAction(normalized.id)
          await deleteLocalSession(normalized.id)
          return
        }

        await upsertSessionRow(normalized, uid)
        await upsertLogs(normalized, uid)

        if (normalized.status === 'completed') {
          const result = await finishSessionAction({
            sessionId: normalized.id,
            durationSeconds: normalized.durationSeconds ?? 0,
            prs: normalized.prs,
          })
          if (result.error) {
            throw new Error(result.error)
          }
        }
      })(),
      `Session ${sessionId.slice(0, 8)}`,
    )

    const after = await getLocalSession(normalized.id)
    if (after && fingerprint(after) !== before) {
      await markSessionSync(normalized.id, 'pending')
      if (depth < 8) return syncLocalSession(normalized.id, uid, depth + 1)
      return
    }
    retryAttempt.delete(sessionId)
    retryAfter.delete(sessionId)
    await markSessionSync(normalized.id, 'synced')
    offlineLog('sync.result', { sessionId, ok: true, userId: uid })
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      retryAttempt.delete(sessionId)
      retryAfter.delete(sessionId)
      await markSessionSync(sessionId, 'synced')
      offlineLog('sync.result', { sessionId, ok: true, reason: 'already-exists' })
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

/** Manual retry ignores backoff so stuck items run immediately. */
export function retryOfflineQueueNow() {
  retryAfter.clear()
  sessionLocks.clear()
}
