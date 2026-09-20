import { createClient } from '@/lib/supabase/client'
import type { SplitDetailRow } from '@/lib/database.types'
import { toSplitDetail } from '@/lib/data/split-adapter'
import {
  getOfflineDb,
  type CachedSplit,
  type CachedSplitOfflinePin,
} from '@/lib/offline/db'
import { OFFLINE_CHANGED_EVENT } from '@/lib/offline/session-store'
import { logServerError } from '@/lib/log'

const META_OFFLINE_SPLIT_IDS = 'offlineSplitIds'

/** Serialize pin-set RMW so concurrent save/remove/refresh cannot clobber pins. */
let pinWriteChain: Promise<unknown> = Promise.resolve()

function withPinWrite<T>(work: () => Promise<T>): Promise<T> {
  const run = pinWriteChain.catch(() => undefined).then(work)
  pinWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

const SPLIT_DETAIL_SELECT = `
  id, user_id, name, description, days_per_week, is_system, is_shared, source_split_id, category, created_at, updated_at,
  split_days (
    id, split_id, name, day_order, subtitle, created_at,
    split_day_exercises (
      id, split_day_id, lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order, created_at,
      lift_types ( id, slug, name, image_url, muscle_group, category )
    )
  )
`

export type OfflineSplitIssue =
  | 'missing-snapshot'
  | 'empty-program'
  | 'incomplete-media'
  | 'not-ready'

export type OfflineSavedSplit = {
  id: string
  slug: string
  name: string
  days: number
  /** True only when snapshot + required media verified complete. */
  ready: boolean
  issue?: OfflineSplitIssue
  mediaExpected?: number
  mediaCached?: number
}

export type RemoveOfflineSplitResult = {
  unpinned: boolean
  snapshotRemoved: boolean
  retainedForSession: boolean
  retainedForMutation: boolean
}

export type SaveOfflineProgress = {
  phase: 'fetch' | 'media' | 'commit'
  percent: number
  done?: number
  total?: number
}

export type SaveOfflineErrorCode =
  | 'offline'
  | 'network'
  | 'media'
  | 'quota'
  | 'system'
  | 'generic'

export type SaveOfflineResult =
  | { ok: true }
  | { ok: false; error: string; code: SaveOfflineErrorCode }

function notifyOfflineChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFLINE_CHANGED_EVENT))
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String((err as { name?: string }).name) : ''
  const message =
    err instanceof Error
      ? err.message
      : String((err as { message?: string }).message ?? '')
  return (
    name === 'QuotaExceededError' ||
    /quota|storage|disk full|not enough space/i.test(message)
  )
}

function normalizeSplitRow(raw: SplitDetailRow): SplitDetailRow {
  return {
    ...raw,
    is_shared: Boolean(raw.is_shared),
    source_split_id: raw.source_split_id ?? null,
    split_days: [...(raw.split_days ?? [])]
      .sort((a, b) => a.day_order - b.day_order)
      .map((day) => ({
        ...day,
        split_day_exercises: [...(day.split_day_exercises ?? [])].sort(
          (a, b) => a.exercise_order - b.exercise_order,
        ),
      })),
  }
}

function cachedFromRow(row: SplitDetailRow): CachedSplit {
  const normalized = normalizeSplitRow(row)
  return {
    id: normalized.id,
    detail: toSplitDetail(normalized),
    row: normalized,
    updatedAt: new Date().toISOString(),
  }
}

function programHasExercises(split: CachedSplit): boolean {
  return (split.detail.schedule ?? []).some(
    (day) => (day.exercises ?? []).length > 0,
  )
}

function makeOfflinePin(requiredMedia: string[]): CachedSplitOfflinePin {
  return {
    ready: true,
    requiredMedia: [...requiredMedia],
    readyAt: new Date().toISOString(),
  }
}

/** Pin set — sole source of truth for offline split availability. */
export async function getOfflineSplitIds(): Promise<string[]> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_OFFLINE_SPLIT_IDS)
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]
}

export async function isSplitSavedForOffline(splitId: string): Promise<boolean> {
  const ids = await getOfflineSplitIds()
  return ids.includes(splitId)
}

async function fetchSplitSnapshot(splitId: string): Promise<CachedSplit | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('splits')
    .select(SPLIT_DETAIL_SELECT)
    .eq('id', splitId)
    .maybeSingle()
  if (error) {
    logServerError('[offline-splits] fetch', error)
    return null
  }
  if (!data) return null
  return cachedFromRow(data as unknown as SplitDetailRow)
}

async function splitNeedsLocalRetention(splitId: string): Promise<{
  session: boolean
  mutation: boolean
}> {
  const db = await getOfflineDb()
  const [sessions, mutations] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('splitMutations'),
  ])
  const session = sessions.some(
    (row) =>
      row.splitId === splitId &&
      (row.status === 'in_progress' || row.syncStatus !== 'synced'),
  )
  const mutation = mutations.some(
    (row) => row.splitId === splitId && row.syncStatus !== 'synced',
  )
  return { session, mutation }
}

async function verifyRequiredMedia(requiredMedia: string[]): Promise<{
  expected: number
  cached: number
  ok: boolean
}> {
  if (requiredMedia.length === 0) {
    return { expected: 0, cached: 0, ok: true }
  }
  const { isExerciseMediaCached } = await import(
    '@/lib/offline/prefetch-exercise-media'
  )
  let cached = 0
  for (const url of requiredMedia) {
    if (await isExerciseMediaCached(url)) cached += 1
  }
  return {
    expected: requiredMedia.length,
    cached,
    ok: cached === requiredMedia.length,
  }
}

/**
 * Lightweight integrity check for one pinned split (snapshot + media).
 * Does not mutate storage.
 */
export async function inspectOfflineSplit(
  splitId: string,
  row?: CachedSplit | null,
): Promise<OfflineSavedSplit> {
  const snapshot = row === undefined ? await (await getOfflineDb()).get('splits', splitId) : row
  if (!snapshot) {
    return {
      id: splitId,
      slug: splitId,
      name: 'Unavailable split',
      days: 0,
      ready: false,
      issue: 'missing-snapshot',
    }
  }

  const base: OfflineSavedSplit = {
    id: snapshot.id,
    slug: snapshot.detail.slug,
    name: snapshot.detail.name,
    days: snapshot.detail.daysPerWeek,
    ready: false,
  }

  if (!programHasExercises(snapshot)) {
    return { ...base, issue: 'empty-program' }
  }

  const pinMeta = snapshot.offlinePin
  if (!pinMeta?.ready) {
    // Legacy pin: verify current media URLs on the snapshot.
    const { collectExerciseMediaUrls, countCachedExerciseMedia } = await import(
      '@/lib/offline/prefetch-exercise-media'
    )
    const urls = collectExerciseMediaUrls([{ detail: snapshot.detail }])
    const counts = await countCachedExerciseMedia(urls)
    if (counts.total > 0 && counts.cached < counts.total) {
      return {
        ...base,
        issue: 'incomplete-media',
        mediaExpected: counts.total,
        mediaCached: counts.cached,
      }
    }
    // Treat fully-cached legacy pins as ready for listing (no rewrite required).
    return {
      ...base,
      ready: true,
      mediaExpected: counts.total,
      mediaCached: counts.cached,
    }
  }

  const media = await verifyRequiredMedia(pinMeta.requiredMedia)
  if (!media.ok) {
    return {
      ...base,
      issue: 'incomplete-media',
      mediaExpected: media.expected,
      mediaCached: media.cached,
    }
  }

  return {
    ...base,
    ready: true,
    mediaExpected: media.expected,
    mediaCached: media.cached,
  }
}

/**
 * Explicitly save one split for offline: full nested snapshot + all exercise
 * media, then pin. Success is only returned after commit — never after a
 * partial download. Failure leaves no new pin (rollback).
 */
export async function saveSplitForOffline(
  splitId: string,
  options?: { onProgress?: (progress: SaveOfflineProgress) => void },
): Promise<SaveOfflineResult> {
  const onProgress = options?.onProgress

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      code: 'offline',
      error: 'Connect to save a split for offline.',
    }
  }

  onProgress?.({ phase: 'fetch', percent: 0 })

  let snapshot: CachedSplit | null
  try {
    snapshot = await fetchSplitSnapshot(splitId)
  } catch (err) {
    if (isQuotaError(err)) {
      return {
        ok: false,
        code: 'quota',
        error:
          'Not enough storage on this device to save that split offline. Free up space and try again.',
      }
    }
    return {
      ok: false,
      code: 'network',
      error: 'Could not load that split to save offline. Check your connection and try again.',
    }
  }

  if (!snapshot) {
    return {
      ok: false,
      code: 'network',
      error: 'Could not load that split to save offline.',
    }
  }
  if (snapshot.row.is_system) {
    return {
      ok: false,
      code: 'system',
      error: 'System programs cannot be saved for offline.',
    }
  }
  if (!programHasExercises(snapshot)) {
    return {
      ok: false,
      code: 'generic',
      error: 'That split has no exercises to save offline.',
    }
  }

  onProgress?.({ phase: 'media', percent: 5, done: 0, total: 0 })

  const { prefetchMediaForSplits } = await import(
    '@/lib/offline/prefetch-exercise-media'
  )

  let mediaResult
  try {
    mediaResult = await prefetchMediaForSplits([{ detail: snapshot.detail }], {
      strict: true,
      onProgress: (p) => {
        // Reserve 5–90% for media download.
        const percent = 5 + Math.round((p.percent / 100) * 85)
        onProgress?.({
          phase: 'media',
          percent,
          done: p.done,
          total: p.total,
        })
      },
    })
  } catch (err) {
    if (isQuotaError(err)) {
      return {
        ok: false,
        code: 'quota',
        error:
          'Not enough storage on this device to download exercise media. Free up space and try again.',
      }
    }
    return {
      ok: false,
      code: 'media',
      error:
        'Download interrupted before exercise media finished. Nothing was saved — try again when you have a stable connection.',
    }
  }

  if (mediaResult.quotaExceeded) {
    return {
      ok: false,
      code: 'quota',
      error:
        'Not enough storage on this device to download exercise media. Free up space and try again.',
    }
  }
  if (!mediaResult.ok) {
    return {
      ok: false,
      code: 'media',
      error:
        'Download interrupted before exercise media finished. Nothing was saved — try again when you have a stable connection.',
    }
  }

  onProgress?.({ phase: 'commit', percent: 92 })

  const readySnapshot: CachedSplit = {
    ...snapshot,
    offlinePin: makeOfflinePin(mediaResult.requiredMedia),
    updatedAt: new Date().toISOString(),
  }

  try {
    await withPinWrite(async () => {
      const db = await getOfflineDb()
      const tx = db.transaction(['splits', 'meta'], 'readwrite')
      await tx.objectStore('splits').put(readySnapshot)
      const current = await tx.objectStore('meta').get(META_OFFLINE_SPLIT_IDS)
      const pins = Array.isArray(current)
        ? current.filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          )
        : []
      if (!pins.includes(splitId)) {
        await tx.objectStore('meta').put(
          [...new Set([...pins, splitId])],
          META_OFFLINE_SPLIT_IDS,
        )
      }
      await tx.done
    })
  } catch (err) {
    // Media may already be in Cache Storage; without a pin the split is not
    // treated as saved. Do not leave a half-ready pin.
    if (isQuotaError(err)) {
      return {
        ok: false,
        code: 'quota',
        error:
          'Not enough storage on this device to finish saving that split. Free up space and try again.',
      }
    }
    logServerError('[offline-splits] commit', err)
    return {
      ok: false,
      code: 'generic',
      error: 'Could not finish saving that split offline. Nothing was marked as saved — try again.',
    }
  }

  onProgress?.({ phase: 'commit', percent: 100 })
  notifyOfflineChanged()
  return { ok: true }
}

/**
 * Unpin a split. Drops the local snapshot unless an in-progress / unsynced
 * session or pending mutation still needs the row.
 *
 * Pin meta + snapshot delete run under the same write lock as save commits so
 * a concurrent save cannot land a pin that this call then deletes.
 */
export async function removeSplitFromOffline(
  splitId: string,
): Promise<RemoveOfflineSplitResult> {
  return withPinWrite(async () => {
    const db = await getOfflineDb()
    const current = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    const pins = Array.isArray(current)
      ? current.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    const wasPinned = pins.includes(splitId)
    if (wasPinned) {
      await db.put(
        'meta',
        pins.filter((id) => id !== splitId),
        META_OFFLINE_SPLIT_IDS,
      )
      notifyOfflineChanged()
    }

    const retention = await splitNeedsLocalRetention(splitId)
    let snapshotRemoved = false
    if (!retention.session && !retention.mutation) {
      // Re-check pin set inside the lock — a concurrent save would wait on us,
      // so after we finish unpinning, absence of the pin is authoritative.
      const latest = await db.get('meta', META_OFFLINE_SPLIT_IDS)
      const stillPinned =
        Array.isArray(latest) &&
        latest.some((id) => typeof id === 'string' && id === splitId)
      if (!stillPinned) {
        await db.delete('splits', splitId)
        snapshotRemoved = true
        if (!wasPinned) notifyOfflineChanged()
      }
    }

    return {
      unpinned: wasPinned,
      snapshotRemoved,
      retainedForSession: retention.session,
      retainedForMutation: retention.mutation,
    }
  })
}

/** Clear pin when a split is deleted from the account. */
export async function clearOfflinePin(splitId: string): Promise<void> {
  await withPinWrite(async () => {
    const db = await getOfflineDb()
    const current = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    const pins = Array.isArray(current)
      ? current.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    if (!pins.includes(splitId)) return
    await db.put(
      'meta',
      pins.filter((id) => id !== splitId),
      META_OFFLINE_SPLIT_IDS,
    )
    notifyOfflineChanged()
  })
}

export async function listOfflineSavedSplits(): Promise<OfflineSavedSplit[]> {
  const [pins, db] = await Promise.all([getOfflineSplitIds(), getOfflineDb()])
  if (pins.length === 0) return []

  const rows = await db.getAll('splits')
  const byId = new Map(rows.map((row) => [row.id, row]))
  const listed: OfflineSavedSplit[] = []

  for (const pin of pins) {
    const row = byId.get(pin) ?? null
    if (row && (row.row.is_system || !row.row.user_id)) continue
    listed.push(await inspectOfflineSplit(pin, row))
  }

  return listed.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

/**
 * Offline Start Session picker: only splits explicitly saved for offline (pins).
 * Filters by current user when identity is known; if identity is missing, still
 * lists pins so a cleared session storage race does not hide saved programs.
 */
export async function listOfflineUserSplitsForStart(): Promise<OfflineSavedSplit[]> {
  const { resolveSessionUserId } = await import('@/lib/offline/cache')
  const uid = await resolveSessionUserId().catch(() => null)

  const [pins, db] = await Promise.all([getOfflineSplitIds(), getOfflineDb()])
  if (pins.length === 0) return []

  const rows = await db.getAll('splits')
  const byId = new Map(rows.map((row) => [row.id, row]))

  const listed: OfflineSavedSplit[] = []
  for (const pin of pins) {
    const row = byId.get(pin) ?? null
    if (row && (row.row.is_system || !row.row.user_id)) continue
    if (uid && row && row.row.user_id !== uid) continue
    listed.push(await inspectOfflineSplit(pin, row))
  }

  return listed.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/**
 * Re-fetch pinned snapshots only (no store-wide clear).
 * Media must finish before the ready pin metadata is updated.
 */
export async function refreshPinnedSplits(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0

  const pins = await getOfflineSplitIds()
  let updated = 0
  const { prefetchMediaForSplits } = await import(
    '@/lib/offline/prefetch-exercise-media'
  )

  for (const id of pins) {
    try {
      const snapshot = await fetchSplitSnapshot(id)
      if (!snapshot || snapshot.row.is_system) continue

      const media = await prefetchMediaForSplits([{ detail: snapshot.detail }], {
        strict: true,
      })
      if (!media.ok) continue

      const readySnapshot: CachedSplit = {
        ...snapshot,
        offlinePin: makeOfflinePin(media.requiredMedia),
        updatedAt: new Date().toISOString(),
      }
      const db = await getOfflineDb()
      await db.put('splits', readySnapshot)
      updated += 1
    } catch (err) {
      logServerError('[offline-splits] refresh pin', err)
    }
  }

  await pruneUnpinnedSplitRows()
  if (updated > 0) notifyOfflineChanged()
  return updated
}

/** Drop auto-cached leftovers that are neither pinned nor needed. */
export async function pruneUnpinnedSplitRows(): Promise<number> {
  const db = await getOfflineDb()
  const [pins, sessions, mutations, all] = await Promise.all([
    getOfflineSplitIds(),
    db.getAll('sessions'),
    db.getAll('splitMutations'),
    db.getAll('splits'),
  ])
  const keep = new Set(pins)
  for (const session of sessions) {
    if (
      session.splitId &&
      (session.status === 'in_progress' || session.syncStatus !== 'synced')
    ) {
      keep.add(session.splitId)
    }
  }
  for (const mutation of mutations) {
    if (mutation.syncStatus !== 'synced') keep.add(mutation.splitId)
  }

  let removed = 0
  for (const row of all) {
    if (keep.has(row.id)) continue
    await db.delete('splits', row.id)
    removed += 1
  }
  if (removed > 0) notifyOfflineChanged()
  return removed
}
