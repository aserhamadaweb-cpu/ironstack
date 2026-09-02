import {
  getOfflineDb,
  type LocalLiftLog,
  type LocalSession,
  type LocalSessionPr,
  type OfflineSyncStatus,
} from '@/lib/offline/db'
import { offlineLog, offlineWarn } from '@/lib/offline/debug'

export const OFFLINE_CHANGED_EVENT = 'ironstack-offline-changed'

function notifyOfflineChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFLINE_CHANGED_EVENT))
}

export async function putLocalSession(session: LocalSession) {
  const db = await getOfflineDb()
  const row = {
    ...session,
    updatedAt: new Date().toISOString(),
  }
  await db.put('sessions', row)
  offlineLog('local.write.session', {
    id: row.id,
    userId: row.userId,
    status: row.status,
    syncStatus: row.syncStatus,
    logs: row.logs.length,
  })
  notifyOfflineChanged()
}

export async function deleteLocalSession(id: string) {
  const db = await getOfflineDb()
  await db.delete('sessions', id)
  notifyOfflineChanged()
}

export async function getLocalSession(id: string): Promise<LocalSession | undefined> {
  const db = await getOfflineDb()
  return db.get('sessions', id)
}

export async function listUnsyncedSessions(): Promise<LocalSession[]> {
  const db = await getOfflineDb()
  const all = await db.getAll('sessions')
  return all.filter((row) => row.syncStatus !== 'synced')
}

export async function countUnsyncedSessions(): Promise<number> {
  const rows = await listUnsyncedSessions()
  return rows.filter((row) => row.status !== 'in_progress').length
}

export async function listLocalCompletedSessions(): Promise<LocalSession[]> {
  const db = await getOfflineDb()
  const all = await db.getAll('sessions')
  return all
    .filter((row) => row.status === 'completed')
    .sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt))
}

export async function recoverStaleSyncing(maxAgeMs = 45_000) {
  const db = await getOfflineDb()
  const all = await db.getAll('sessions')
  const cutoff = Date.now() - maxAgeMs
  for (const row of all) {
    if (
      row.syncStatus === 'syncing' &&
      new Date(row.updatedAt).getTime() < cutoff
    ) {
      await putLocalSession({
        ...row,
        syncStatus: 'pending',
        syncError: row.syncError,
      })
    }
  }
}

export async function markSessionSync(
  id: string,
  syncStatus: OfflineSyncStatus,
  syncError: string | null = null,
) {
  const existing = await getLocalSession(id)
  if (!existing) return
  await putLocalSession({ ...existing, syncStatus, syncError })
}

export async function upsertLocalLogs(
  sessionId: string,
  logs: LocalLiftLog[],
): Promise<LocalSession | null> {
  if (logs.length === 0) {
    return getLocalSession(sessionId).then((row) => row ?? null)
  }
  const existing = await getLocalSession(sessionId)
  if (!existing) return null
  const byId = new Map(existing.logs.map((row) => [row.id, row]))
  for (const log of logs) {
    byId.set(log.id, log)
  }
  const nextLogs = [...byId.values()].sort(
    (a, b) => a.setNumber - b.setNumber || a.loggedAt.localeCompare(b.loggedAt),
  )
  const next = {
    ...existing,
    logs: nextLogs,
    syncStatus: 'pending' as const,
    syncError: null,
  }
  await putLocalSession(next)
  return next
}

export async function upsertLocalLog(
  sessionId: string,
  log: LocalLiftLog,
): Promise<LocalSession | null> {
  const existing = await getLocalSession(sessionId)
  if (!existing) return null
  const logs = existing.logs.filter((row) => row.id !== log.id)
  logs.push(log)
  logs.sort((a, b) => a.setNumber - b.setNumber || a.loggedAt.localeCompare(b.loggedAt))
  const next = {
    ...existing,
    logs,
    syncStatus: 'pending' as const,
    syncError: null,
  }
  await putLocalSession(next)
  return next
}

export async function listActiveLocalSessions(
  userId?: string | null,
): Promise<LocalSession[]> {
  const db = await getOfflineDb()
  const all = await db.getAll('sessions')
  return all
    .filter(
      (row) =>
        row.status === 'in_progress' &&
        (!userId || row.userId === userId),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function getActiveLocalSession(
  userId?: string | null,
): Promise<LocalSession | null> {
  const rows = await listActiveLocalSessions(userId)
  return rows[0] ?? null
}

export async function saveSessionProgress(
  sessionId: string,
  progress: LocalSession['progress'],
): Promise<LocalSession | null> {
  const db = await getOfflineDb()
  const tx = db.transaction('sessions', 'readwrite')
  const store = tx.objectStore('sessions')
  const existing = await store.get(sessionId)
  if (!existing || existing.status !== 'in_progress') {
    await tx.done
    return existing ?? null
  }
  const next: LocalSession = {
    ...existing,
    progress,
    updatedAt: new Date().toISOString(),
  }
  await store.put(next)
  await tx.done
  offlineLog('local.write.session.progress', { id: next.id })
  return next
}

export async function cancelAllLocalActiveSessions(
  userId?: string | null,
): Promise<string[]> {
  const rows = await listActiveLocalSessions(userId)
  const ids: string[] = []
  for (const row of rows) {
    await putLocalSession({
      ...row,
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
      progress: null,
      syncStatus: 'pending',
      syncError: null,
    })
    ids.push(row.id)
  }
  return ids
}

export async function cancelLocalSession(sessionId: string): Promise<void> {
  const existing = await getLocalSession(sessionId)
  if (!existing) return
  if (existing.status === 'completed') return
  await putLocalSession({
    ...existing,
    status: 'cancelled',
    finishedAt: new Date().toISOString(),
    progress: null,
    syncStatus: 'pending',
    syncError: null,
  })
}

export async function createLocalSession(input: {
  id: string
  userId: string
  splitId: string
  splitDayId: string
  startedAt: string
}): Promise<LocalSession> {
  const others = await listActiveLocalSessions(input.userId)
  for (const row of others) {
    if (row.id === input.id) continue
    await cancelLocalSession(row.id)
  }

  const existing = await getLocalSession(input.id)
  if (existing?.status === 'in_progress') {
    return existing
  }

  const session: LocalSession = {
    id: input.id,
    userId: input.userId,
    splitId: input.splitId,
    splitDayId: input.splitDayId,
    status: 'in_progress',
    startedAt: input.startedAt,
    finishedAt: null,
    durationSeconds: null,
    logs: existing?.logs ?? [],
    prs: existing?.prs ?? [],
    progress: existing?.progress ?? null,
    syncStatus: 'pending',
    syncError: null,
    updatedAt: new Date().toISOString(),
  }
  await putLocalSession(session)
  return session
}

export async function completeLocalSession(input: {
  sessionId: string
  durationSeconds: number
  prs: LocalSessionPr[]
}): Promise<LocalSession | null> {
  const existing = await getLocalSession(input.sessionId)
  if (!existing) {
    offlineWarn('local.write.session.missing', { sessionId: input.sessionId })
    return null
  }
  const next: LocalSession = {
    ...existing,
    status: 'completed',
    finishedAt: new Date().toISOString(),
    durationSeconds: input.durationSeconds,
    prs: input.prs,
    progress: null,
    syncStatus: 'pending',
    syncError: null,
  }
  await putLocalSession(next)
  return next
}

/** Always persist a completed session to the outbox, creating the row if start/log writes were lost. */
export async function ensureCompletedLocalSession(input: {
  id: string
  userId: string
  splitId: string
  splitDayId: string
  startedAt: string
  durationSeconds: number
  logs: LocalLiftLog[]
  prs: LocalSessionPr[]
}): Promise<LocalSession> {
  const existing = await getLocalSession(input.id)
  if (existing?.status === 'cancelled') {
    return existing
  }
  const existingLogs = existing?.logs ?? []
  const logs =
    existingLogs.length >= input.logs.length && existingLogs.length > 0
      ? existingLogs
      : input.logs.length > 0
        ? input.logs
        : existingLogs
  if (existing?.status === 'completed') {
    const next: LocalSession = {
      ...existing,
      durationSeconds: existing.durationSeconds ?? input.durationSeconds,
      logs,
      prs: existing.prs.length > 0 ? existing.prs : input.prs,
      progress: null,
      syncStatus: existing.syncStatus === 'synced' ? 'synced' : 'pending',
      syncError: null,
    }
    if (
      next.syncStatus === existing.syncStatus &&
      next.logs === existing.logs &&
      next.prs === existing.prs
    ) {
      return existing
    }
    await putLocalSession(next)
    return next
  }
  const next: LocalSession = {
    id: input.id,
    userId: existing?.userId || input.userId,
    splitId: existing?.splitId || input.splitId,
    splitDayId: existing?.splitDayId || input.splitDayId,
    status: 'completed',
    startedAt: existing?.startedAt || input.startedAt,
    finishedAt: new Date().toISOString(),
    durationSeconds: input.durationSeconds,
    logs,
    prs: input.prs,
    progress: null,
    syncStatus: 'pending',
    syncError: null,
    updatedAt: new Date().toISOString(),
  }
  await putLocalSession(next)
  offlineLog('outbox.enqueue.session', {
    id: next.id,
    created: !existing,
    logs: next.logs.length,
    userId: next.userId,
  })
  return next
}
