import { createClient } from '@/lib/supabase/client'
import type { LiftType, PersonalRecord } from '@/lib/database.types'
import type { LibraryExercise } from '@/lib/exercise-library'
import { logServerError } from '@/lib/log'
import { getOfflineDb, type CachedSplit } from '@/lib/offline/db'
import { liftTypeToLibraryExercise } from '@/lib/exercise-library'
import { identityFromBrowserStorage } from '@/lib/supabase/stored-user-id'
import { pruneUnpinnedSplitRows } from '@/lib/offline/offline-splits'

const META_USER = 'userId'
const META_CACHED_AT = 'workoutCachedAt'
const META_LIBRARY = 'exerciseLibrary'
const WORKOUT_CACHE_TTL_MS = 5 * 60_000

export async function setCachedUserId(userId: string) {
  const db = await getOfflineDb()
  await db.put('meta', userId, META_USER)
}

export async function getCachedUserId(): Promise<string | null> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_USER)
  return typeof value === 'string' ? value : null
}

/** Refresh the JWT after a stretch offline; fall back to the locally stored session. */
export async function revalidateAuthSession(): Promise<string | null> {
  const local = await resolveSessionUserId()
  if (typeof navigator !== 'undefined' && !navigator.onLine) return local

  try {
    const supabase = createClient()
    try {
      const { data, error } = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth refresh timed out')), 12_000)
        }),
      ])
      const id = !error ? data.session?.user?.id : null
      if (id) {
        await setCachedUserId(id)
        return id
      }
    } catch {
      /* timed out or network — use the local session */
    }
    return local
  } catch {
    return local
  }
}

/**
 * User id for local-first writes (sessions, sets, splits outbox).
 * Reads the cached session from storage / IndexedDB — never getUser()
 * (that requires network). Expired tokens still carry user.id; writes go
 * to the outbox and authenticate via RLS when they actually sync.
 */
export async function resolveSessionUserId(): Promise<string | null> {
  const fromIdb = await getCachedUserId().catch(() => null)
  const fromStorage = identityFromBrowserStorage()?.userId ?? null
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  let fromSession: string | null = null
  if (!offline) {
    try {
      const supabase = createClient()
      fromSession = await Promise.race([
        supabase.auth
          .getSession()
          .then(({ data }) => data.session?.user?.id ?? null),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 2_000)
        }),
      ])
    } catch {
      fromSession = null
    }
  }

  const id = fromSession || fromStorage || fromIdb
  if (id) await setCachedUserId(id).catch(() => undefined)
  return id
}

export async function getCachedSplits(): Promise<CachedSplit[]> {
  const db = await getOfflineDb()
  return db.getAll('splits')
}

/** Keep offline cache in sync when toggling profile sharing. */
export async function patchCachedSplitShared(
  splitId: string,
  isShared: boolean,
): Promise<void> {
  const db = await getOfflineDb()
  const cached = await db.get('splits', splitId)
  if (!cached) return
  cached.row.is_shared = isShared
  cached.detail = {
    ...cached.detail,
    isShared,
  }
  cached.updatedAt = new Date().toISOString()
  await db.put('splits', cached)
}

export async function getCachedSplit(idOrSlug: string): Promise<CachedSplit | null> {
  const db = await getOfflineDb()
  try {
    const exact = await db.get('splits', idOrSlug)
    if (exact) return exact
    const all = await db.getAll('splits')
    return (
      all.find(
        (row) =>
          row.id === idOrSlug ||
          row.detail.slug === idOrSlug ||
          row.detail.name.toLowerCase() === idOrSlug.toLowerCase(),
      ) ?? null
    )
  } catch {
    return null
  }
}

export async function getCachedLiftTypes(): Promise<LiftType[]> {
  const db = await getOfflineDb()
  return db.getAll('liftTypes')
}

export async function getCachedPersonalRecords(): Promise<PersonalRecord[]> {
  const db = await getOfflineDb()
  return db.getAll('personalRecords')
}

export async function cacheExerciseLibrary(library: LibraryExercise[]) {
  const db = await getOfflineDb()
  await db.put('meta', library, META_LIBRARY)
}

export async function getCachedExerciseLibrary(): Promise<LibraryExercise[]> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_LIBRARY)
  return Array.isArray(value) ? (value as LibraryExercise[]) : []
}

const META_HOME = 'homeSnapshot'

export type CachedHomeSnapshot = {
  userId: string
  displayName: string
  email?: string | null
  username?: string | null
  avatarUrl?: string | null
  isGuest: boolean
  weightUnit: 'kg' | 'lb'
  lastSessionCaption: string
  streakDays: number
  streakHoursLeft: number | null
  weekActivity: Array<{ day: string; done: boolean }>
  weekSessionCount: number
}

export async function saveHomeSnapshot(snapshot: CachedHomeSnapshot) {
  const db = await getOfflineDb()
  await db.put('meta', snapshot, META_HOME)
}

export async function getHomeSnapshot(): Promise<CachedHomeSnapshot | null> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_HOME)
  if (!value || typeof value !== 'object') return null
  return value as CachedHomeSnapshot
}

export function recordsToPreviousBests(
  records: PersonalRecord[],
): Record<string, { weight: number; reps: number }> {
  const map: Record<string, { weight: number; reps: number }> = {}
  for (const row of records) {
    if (!row.is_current_pr) continue
    const current = map[row.lift_type_id]
    if (!current || row.weight > current.weight) {
      map[row.lift_type_id] = { weight: Number(row.weight), reps: Number(row.reps) }
    }
  }
  return map
}

/**
 * Refresh lift types, personal records, and exercise library into IndexedDB.
 * Does NOT mirror all customs/catalog into `splits` — offline availability is
 * driven only by meta.offlineSplitIds via saveSplitForOffline / refreshPinnedSplits.
 * Skips network when a fresh cache already exists (unless `force`).
 */
export async function refreshWorkoutCache(
  userId?: string,
  options?: { force?: boolean },
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false

  if (!options?.force) {
    try {
      const db = await getOfflineDb()
      const cachedAt = await db.get('meta', META_CACHED_AT)
      const liftCount = await db.count('liftTypes')
      if (
        typeof cachedAt === 'string' &&
        liftCount > 100 &&
        Number.isFinite(Date.parse(cachedAt)) &&
        Date.now() - Date.parse(cachedAt) < WORKOUT_CACHE_TTL_MS
      ) {
        return true
      }
    } catch {
      /* fall through to network refresh */
    }
  }

  const supabase = createClient()
  let uid = userId
  if (!uid) {
    const { data } = await supabase.auth.getSession()
    uid = data.session?.user?.id
  }
  if (!uid) return false

  const [liftsRes, prsRes] = await Promise.all([
    supabase
      .from('lift_types')
      .select(
        'id, slug, name, category, sort_order, is_system, image_url, muscle_group, created_at',
      )
      .order('name', { ascending: true }),
    supabase
      .from('personal_records')
      .select('id, user_id, lift_type_id, weight, reps, is_current_pr, logged_at')
      .eq('user_id', uid)
      .eq('is_current_pr', true),
  ])

  if (liftsRes.error || prsRes.error) {
    logServerError('[offline-cache]', liftsRes.error || prsRes.error)
    return false
  }

  const db = await getOfflineDb()
  const tx = db.transaction(['liftTypes', 'personalRecords', 'meta'], 'readwrite')

  await tx.objectStore('liftTypes').clear()
  const lifts = (liftsRes.data ?? []) as LiftType[]
  for (const lift of lifts) {
    await tx.objectStore('liftTypes').put(lift)
  }

  await tx.objectStore('personalRecords').clear()
  for (const pr of (prsRes.data ?? []) as PersonalRecord[]) {
    await tx.objectStore('personalRecords').put(pr)
  }

  await tx.objectStore('meta').put(uid, META_USER)
  await tx.objectStore('meta').put(new Date().toISOString(), META_CACHED_AT)
  const existingLib = await tx.objectStore('meta').get(META_LIBRARY)
  const existingCount = Array.isArray(existingLib) ? existingLib.length : 0
  if (lifts.length > existingCount) {
    await tx.objectStore('meta').put(
      lifts.map(liftTypeToLibraryExercise),
      META_LIBRARY,
    )
  }
  await tx.done

  // Drop leftovers from the old auto-mirror that are neither pinned nor needed.
  await pruneUnpinnedSplitRows().catch(() => 0)

  return true
}
