import { createClient } from '@/lib/supabase/client'
import { getOfflineDb } from '@/lib/offline/db'
import { deleteLocalSession, listUnsyncedSessions } from '@/lib/offline/session-store'
import {
  listUnsyncedSplitMutations,
  removeLocalSplit,
} from '@/lib/offline/split-store'
import { getDeletedSplitIds } from '@/lib/offline/deleted-splits'

const STALE_MS = 24 * 60 * 60 * 1000
const META_ORPHAN_NOTICE = 'orphanPurgeNotice'

export type OrphanPurgeNotice = {
  sessions: number
  splits: number
}

function ageMs(iso: string | null | undefined) {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Date.now() - t
}

export async function getOrphanPurgeNotice(): Promise<OrphanPurgeNotice | null> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_ORPHAN_NOTICE)
  if (!value || typeof value !== 'object') return null
  const notice = value as OrphanPurgeNotice
  const sessions = Number(notice.sessions) || 0
  const splits = Number(notice.splits) || 0
  if (sessions <= 0 && splits <= 0) return null
  return { sessions, splits }
}

export async function dismissOrphanPurgeNotice() {
  const db = await getOfflineDb()
  await db.delete('meta', META_ORPHAN_NOTICE)
}

async function rememberNotice(next: OrphanPurgeNotice) {
  if (next.sessions <= 0 && next.splits <= 0) return
  const existing = (await getOrphanPurgeNotice()) ?? { sessions: 0, splits: 0 }
  const db = await getOfflineDb()
  await db.put(
    'meta',
    {
      sessions: existing.sessions + next.sessions,
      splits: existing.splits + next.splits,
    },
    META_ORPHAN_NOTICE,
  )
}

/**
 * Drop local-only sessions/splits that never reached the server after 48h.
 * If the server row exists, mark the local item synced instead.
 */
export async function purgeStaleOfflineItems(): Promise<OrphanPurgeNotice> {
  const removed: OrphanPurgeNotice = { sessions: 0, splits: 0 }
  const removedSplitIds = new Set<string>()
  const online = typeof navigator === 'undefined' || navigator.onLine
  const supabase = online ? createClient() : null
  const deletedSplits = await getDeletedSplitIds()

  const sessions = await listUnsyncedSessions()
  for (const session of sessions) {
    const stale = ageMs(session.updatedAt || session.startedAt) >= STALE_MS
    if (supabase) {
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', session.id)
        .maybeSingle()
      if (data?.id) {
        const { markSessionSync } = await import('@/lib/offline/session-store')
        await markSessionSync(session.id, 'synced')
        continue
      }
    }
    if (!stale) continue
    await deleteLocalSession(session.id)
    removed.sessions += 1
  }

  const mutations = await listUnsyncedSplitMutations()
  for (const mutation of mutations) {
    if (deletedSplits.has(mutation.splitId)) {
      await removeLocalSplit(mutation.splitId)
      continue
    }
    const stale = ageMs(mutation.updatedAt) >= STALE_MS
    if (supabase) {
      const { data } = await supabase
        .from('splits')
        .select('id')
        .eq('id', mutation.splitId)
        .maybeSingle()
      if (data?.id) {
        const db = await getOfflineDb()
        await db.put('splitMutations', {
          ...mutation,
          syncStatus: 'synced',
          syncError: null,
          updatedAt: new Date().toISOString(),
        })
        continue
      }
    }
    if (!stale) continue
    await removeLocalSplit(mutation.splitId)
    removedSplitIds.add(mutation.splitId)
  }

  const db = await getOfflineDb()
  const cached = await db.getAll('splits')
  for (const split of cached) {
    if (split.row.is_system || !split.row.user_id) continue
    if (removedSplitIds.has(split.id) || deletedSplits.has(split.id)) {
      if (deletedSplits.has(split.id)) await removeLocalSplit(split.id)
      continue
    }
    const stale = ageMs(split.updatedAt) >= STALE_MS
    if (!stale) continue
    if (supabase) {
      const { data } = await supabase
        .from('splits')
        .select('id')
        .eq('id', split.id)
        .maybeSingle()
      if (data?.id) continue
    }
    const pending = mutations.some((row) => row.splitId === split.id)
    if (pending) continue
    await removeLocalSplit(split.id)
    removedSplitIds.add(split.id)
  }

  removed.splits = removedSplitIds.size

  await rememberNotice(removed)
  return removed
}
