import { createClient } from '@/lib/supabase/client'
import { getOfflineDb } from '@/lib/offline/db'
import {
  listUnsyncedSessions,
  markSessionSync,
  OFFLINE_CHANGED_EVENT,
} from '@/lib/offline/session-store'
import { listUnsyncedSplitMutations } from '@/lib/offline/split-store'
import { offlineLog } from '@/lib/offline/debug'

/**
 * Drop outbox rows the server already has so the sync badge cannot stay
 * stuck after a successful upload (or a previous tab that never marked synced).
 */
export async function reconcileOutboxWithServer(): Promise<{
  sessions: number
  splits: number
}> {
  const cleared = { sessions: 0, splits: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return cleared

  const supabase = createClient()

  const sessions = await listUnsyncedSessions()
  for (const session of sessions) {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', session.id)
      .maybeSingle()
    if (error || !data?.id || data.status !== 'completed') continue

    await markSessionSync(session.id, 'synced')
    cleared.sessions += 1
  }

  const mutations = await listUnsyncedSplitMutations()
  for (const mutation of mutations) {
    const { data, error } = await supabase
      .from('splits')
      .select('id')
      .eq('id', mutation.splitId)
      .maybeSingle()
    if (error || !data?.id) continue
    const db = await getOfflineDb()
    await db.put('splitMutations', {
      ...mutation,
      syncStatus: 'synced',
      syncError: null,
      updatedAt: new Date().toISOString(),
    })
    cleared.splits += 1
  }

  if (cleared.sessions > 0 || cleared.splits > 0) {
    offlineLog('outbox.reconcile', cleared)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(OFFLINE_CHANGED_EVENT))
    }
  }
  return cleared
}
