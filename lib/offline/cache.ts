import { createClient } from '@/lib/supabase/client'
import type { LiftType, PersonalRecord, SplitDetailRow } from '@/lib/database.types'
import type { LibraryExercise } from '@/lib/exercise-library'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { logServerError } from '@/lib/log'
import { getOfflineDb, type CachedSplit } from '@/lib/offline/db'
import { getDeletedSplitIds } from '@/lib/offline/deleted-splits'
import { liftTypeToLibraryExercise } from '@/lib/exercise-library'
import { identityFromBrowserStorage } from '@/lib/supabase/stored-user-id'

const META_USER = 'userId'
const META_CACHED_AT = 'workoutCachedAt'
const META_LIBRARY = 'exerciseLibrary'

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
  cached.detail.isShared = isShared
  cached.updatedAt = new Date().toISOString()
  await db.put('splits', cached)
}

export async function getCachedSplit(idOrSlug: string): Promise<CachedSplit | null> {
  try {
    const db = await getOfflineDb()
    const exact = await db.get('splits', idOrSlug)
    if (exact) return exact
    const all = await db.getAll('splits')
    return (
      all.find(
        (row) =>
          row.id === idOrSlug ||
          row.detail?.slug === idOrSlug ||
          row.detail?.name?.toLowerCase() === idOrSlug.replace(/-/g, ' ').toLowerCase(),
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

export async function cacheExerciseLibrary(library: LibraryExercise[]) {
  if (library.length === 0) return
  const db = await getOfflineDb()
  await db.put('meta', library, META_LIBRARY)
}

export async function getCachedExerciseLibrary(): Promise<LibraryExercise[]> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_LIBRARY)
  return Array.isArray(value) ? (value as LibraryExercise[]) : []
}

export async function getCachedPersonalRecords(): Promise<PersonalRecord[]> {
  const db = await getOfflineDb()
  return db.getAll('personalRecords')
}

const META_HOME = 'homeSnapshot'

export type CachedHomeSnapshot = {
  userId: string
  displayName: string
  email: string
  username: string | null
  avatarUrl: string | null
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

/** Pull live workout data from Supabase into IndexedDB. No-op when offline. */
export async function refreshWorkoutCache(userId?: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false

  const supabase = createClient()
  let uid = userId
  if (!uid) {
    const { data } = await supabase.auth.getSession()
    uid = data.session?.user?.id
  }
  if (!uid) return false

  const splitSelect = `
    id, user_id, name, description, days_per_week, is_system, is_shared, source_split_id, category, created_at, updated_at,
    split_days (
      id, split_id, name, day_order, subtitle, created_at,
      split_day_exercises (
        id, split_day_id, lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order, created_at,
        lift_types ( id, slug, name, image_url, muscle_group, category )
      )
    )
  `

  const [ownSplitsRes, catalogSplitsRes, liftsRes, prsRes] = await Promise.all([
    supabase
      .from('splits')
      .select(splitSelect)
      .eq('user_id', uid)
      .eq('is_system', false)
      .order('name', { ascending: true }),
    supabase
      .from('splits')
      .select(splitSelect)
      .or('user_id.is.null,is_system.eq.true')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
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

  if (ownSplitsRes.error || catalogSplitsRes.error || liftsRes.error || prsRes.error) {
    logServerError(
      '[offline-cache]',
      ownSplitsRes.error || catalogSplitsRes.error || liftsRes.error || prsRes.error,
    )
    return false
  }

  const splitsRes = {
    data: [...(ownSplitsRes.data ?? []), ...(catalogSplitsRes.data ?? [])].filter(
      (row, index, arr) => arr.findIndex((other) => other.id === row.id) === index,
    ),
  }

  const db = await getOfflineDb()
  const previousSplits = await db.getAll('splits')
  const pendingMutations = await db.getAll('splitMutations')
  const pendingSessions = await db.getAll('sessions')
  const deletedIds = await getDeletedSplitIds()
  const keepIds = new Set<string>()
  for (const local of previousSplits) {
    if (deletedIds.has(local.id)) continue
    if (!local.row.is_system) keepIds.add(local.id)
  }
  for (const row of pendingMutations) {
    if (row.syncStatus !== 'synced' && !deletedIds.has(row.splitId)) {
      keepIds.add(row.splitId)
    }
  }
  for (const session of pendingSessions) {
    if (
      session.syncStatus !== 'synced' &&
      session.splitId &&
      !deletedIds.has(session.splitId)
    ) {
      keepIds.add(session.splitId)
    }
  }
  const kept: CachedSplit[] = []
  for (const id of keepIds) {
    const existing =
      previousSplits.find((row) => row.id === id) ?? (await db.get('splits', id))
    if (existing) kept.push(existing)
  }

  const tx = db.transaction(
    ['splits', 'liftTypes', 'personalRecords', 'meta'],
    'readwrite',
  )

  await tx.objectStore('splits').clear()
  const written = new Set<string>()
  for (const raw of splitsRes.data ?? []) {
    const row = raw as unknown as SplitDetailRow
    row.is_shared = Boolean(row.is_shared)
    row.source_split_id = row.source_split_id ?? null
    try {
      row.split_days = [...(row.split_days ?? [])]
        .sort((a, b) => a.day_order - b.day_order)
        .map((day) => ({
          ...day,
          split_day_exercises: [...(day.split_day_exercises ?? [])].sort(
            (a, b) => a.exercise_order - b.exercise_order,
          ),
        }))
      await tx.objectStore('splits').put({
        id: row.id,
        detail: toSplitDetail(row),
        row,
        updatedAt: new Date().toISOString(),
      })
      written.add(row.id)
    } catch (err) {
      logServerError('[offline-cache] split row', err)
    }
  }

  for (const local of kept) {
    if (written.has(local.id)) continue
    await tx.objectStore('splits').put(local)
  }

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
  return true
}
