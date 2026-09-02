import { discardSessionAction } from '@/lib/data/session-actions'
import {
  cancelAllLocalActiveSessions,
  cancelLocalSession,
  deleteLocalSession,
  getLocalSession,
  listActiveLocalSessions,
} from '@/lib/offline/session-store'
import { queueSessionSync } from '@/lib/offline/sync'

export async function discardPendingSession(
  sessionId: string,
): Promise<{ error: string | null }> {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const remote = await discardSessionAction(sessionId)
    if (remote.error) return { error: remote.error }
    const localIds = new Set(await cancelAllLocalActiveSessions())
    if (sessionId) {
      await cancelLocalSession(sessionId)
      localIds.add(sessionId)
    }
    for (const id of localIds) {
      await deleteLocalSession(id)
    }
    const leftover = await listActiveLocalSessions()
    for (const row of leftover) {
      await deleteLocalSession(row.id)
    }
    return { error: null }
  }

  const localIds = new Set(await cancelAllLocalActiveSessions())
  if (sessionId) {
    await cancelLocalSession(sessionId)
    localIds.add(sessionId)
  }
  for (const id of localIds) {
    const row = await getLocalSession(id)
    if (row) queueSessionSync(row)
  }
  return { error: null }
}
