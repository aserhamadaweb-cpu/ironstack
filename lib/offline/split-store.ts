import { saveCustomSplit, updateCustomSplit, type SaveSplitInput } from '@/lib/data/save-split'
import type { LiftType, SplitDetailRow } from '@/lib/database.types'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { formatTargetReps, parseTargetReps } from '@/lib/split-reps'
import { createClient } from '@/lib/supabase/client'
import {
  getCachedLiftTypes,
  getCachedSplit,
  resolveSessionUserId,
} from '@/lib/offline/cache'
import {
  getOfflineDb,
  type CachedSplit,
  type SplitMutation,
} from '@/lib/offline/db'
import { OFFLINE_CHANGED_EVENT } from '@/lib/offline/session-store'
import { rememberDeletedSplit, getDeletedSplitIds } from '@/lib/offline/deleted-splits'
import { upsertRows } from '@/lib/offline/rest-upsert'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function notify() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFLINE_CHANGED_EVENT))
}

export async function removeLocalSplit(splitId: string) {
  const db = await getOfflineDb()
  await db.delete('splits', splitId)
  await db.delete('splitMutations', splitId)
  await rememberDeletedSplit(splitId)
  notify()
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function matchLift(lifts: LiftType[], exercise: SaveSplitInput['days'][number]['exercises'][number]) {
  const slug = toSlug(exercise.name)
  const library = exercise.libraryId.trim()
  return (
    lifts.find((row) => row.id === library) ||
    lifts.find((row) => row.slug === library) ||
    lifts.find((row) => row.slug === slug) ||
    lifts.find((row) => row.name.toLowerCase() === exercise.name.toLowerCase())
  )
}

export async function listUnsyncedSplitMutations(): Promise<SplitMutation[]> {
  const db = await getOfflineDb()
  const all = await db.getAll('splitMutations')
  return all.filter((row) => row.syncStatus !== 'synced')
}

export async function countUnsyncedSplitMutations(): Promise<number> {
  const pending = await listUnsyncedSplitMutations()
  return pending.length
}

function buildLocalSplit(input: {
  splitId: string
  userId: string
  payload: SaveSplitInput
  lifts: LiftType[]
}): CachedSplit {
  const now = new Date().toISOString()
  const dayIds =
    input.payload.dayIds ?? input.payload.days.map(() => crypto.randomUUID())

  const split_days = input.payload.days.map((day, dayIndex) => {
    const dayId = dayIds[dayIndex] ?? crypto.randomUUID()
    const split_day_exercises = day.exercises.map((exercise, exIndex) => {
      const lift = matchLift(input.lifts, exercise)
      const liftTypeId = lift?.id ?? exercise.libraryId
      const reps = parseTargetReps(exercise.reps)
      return {
        id: crypto.randomUUID(),
        split_day_id: dayId,
        lift_type_id: liftTypeId,
        target_sets: Math.max(1, exercise.sets || 3),
        target_reps_min: reps.min,
        target_reps_max: reps.max,
        exercise_order: exIndex + 1,
        created_at: now,
        lift_types: lift
          ? {
              id: lift.id,
              slug: lift.slug,
              name: lift.name,
              image_url: lift.image_url,
              muscle_group: lift.muscle_group,
              category: lift.category,
            }
          : {
              id: liftTypeId,
              slug: toSlug(exercise.name),
              name: exercise.name,
              image_url: exercise.image,
              muscle_group: exercise.muscles[0] ?? null,
              category: exercise.category ?? 'accessory',
            },
      }
    })
    return {
      id: dayId,
      split_id: input.splitId,
      name: day.name.trim() || `Day ${dayIndex + 1}`,
      day_order: dayIndex + 1,
      subtitle: day.subtitle?.trim() || null,
      created_at: now,
      split_day_exercises,
    }
  })

  const row: SplitDetailRow = {
    id: input.splitId,
    user_id: input.userId,
    name: input.payload.name.trim(),
    description: input.payload.description?.trim() || null,
    days_per_week: input.payload.daysPerWeek,
    is_system: false,
    is_shared: false,
    share_token: null,
    source_split_id: null,
    category: input.payload.category ?? null,
    created_at: now,
    updated_at: now,
    split_days,
  }

  return {
    id: input.splitId,
    detail: toSplitDetail(row),
    row,
    updatedAt: now,
  }
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

/** Cache, pending mutation, or live server row — used by the session screen. */
export async function resolveSplitForSession(
  idOrSlug: string,
): Promise<CachedSplit | null> {
  const cached = await getCachedSplit(idOrSlug)
  if (cached) return cached

  const db = await getOfflineDb()
  const mutations = await db.getAll('splitMutations')
  const mutation = mutations.find(
    (row) => row.splitId === idOrSlug || row.id === idOrSlug,
  )
  if (mutation) {
    const userId = (await resolveSessionUserId().catch(() => null)) || mutation.splitId
    const lifts = await getCachedLiftTypes()
    const built = buildLocalSplit({
      splitId: mutation.splitId,
      userId,
      payload: mutation.payload,
      lifts,
    })
    await db.put('splits', built)
    notify()
    return built
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) return null

  try {
    const supabase = createClient()
    let query = supabase.from('splits').select(SPLIT_DETAIL_SELECT)
    query = UUID_RE.test(idOrSlug)
      ? query.eq('id', idOrSlug)
      : query.ilike('name', idOrSlug.replace(/-/g, ' '))
    const { data, error } = await query.maybeSingle()
    if (error || !data) return null
    const row = normalizeSplitRow(data as unknown as SplitDetailRow)
    const next: CachedSplit = {
      id: row.id,
      detail: toSplitDetail(row),
      row,
      updatedAt: new Date().toISOString(),
    }
    await db.put('splits', next)
    notify()
    return next
  } catch {
    return null
  }
}

function payloadFromCachedSplit(split: CachedSplit): SaveSplitInput {
  const days = [...(split.row.split_days ?? [])].sort(
    (a, b) => a.day_order - b.day_order,
  )
  return {
    id: split.id,
    dayIds: days.map((day) => day.id),
    name: split.row.name,
    description: split.row.description,
    category: split.row.category,
    daysPerWeek: split.row.days_per_week,
    days: days.map((day) => ({
      name: day.name,
      subtitle: day.subtitle,
      exercises: [...(day.split_day_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .map((exercise) => ({
          libraryId: exercise.lift_type_id,
          name: exercise.lift_types?.name ?? 'Exercise',
          muscles: exercise.lift_types?.muscle_group
            ? [exercise.lift_types.muscle_group]
            : [],
          image: exercise.lift_types?.image_url ?? null,
          sets: exercise.target_sets || 3,
          reps: formatTargetReps(
            exercise.target_reps_min,
            exercise.target_reps_max,
            exercise.lift_types?.category === 'cardio' ? '30' : '8–12',
          ),
          category: exercise.lift_types?.category ?? null,
        })),
    })),
  }
}

/** Re-queue custom splits that live only in IndexedDB (no server row, no outbox). */
export async function enqueueMissingSplitMutations(): Promise<number> {
  const db = await getOfflineDb()
  const cached = await db.getAll('splits')
  const mutations = await db.getAll('splitMutations')
  const deleted = await getDeletedSplitIds()
  const byId = new Map(mutations.map((row) => [row.splitId, row]))
  const online = typeof navigator === 'undefined' || navigator.onLine
  const supabase = online ? createClient() : null
  let queued = 0

  for (const split of cached) {
    if (split.row.is_system || !split.row.user_id) continue
    if (deleted.has(split.id)) continue
    const existing = byId.get(split.id)
    if (existing) continue

    let missingOnServer = true
    if (supabase) {
      const { data } = await supabase
        .from('splits')
        .select('id')
        .eq('id', split.id)
        .maybeSingle()
      missingOnServer = !data?.id
    }
    if (!missingOnServer) continue

    const mutation: SplitMutation = {
      id: split.id,
      kind: 'create',
      splitId: split.id,
      payload: payloadFromCachedSplit(split),
      syncStatus: 'pending',
      syncError: null,
      updatedAt: new Date().toISOString(),
    }
    await db.put('splitMutations', mutation)
    queued += 1
  }

  if (queued > 0) notify()
  return queued
}

export async function saveSplitOffline(input: {
  kind: 'create' | 'update'
  splitId: string
  payload: SaveSplitInput
  /** When false, only write IndexedDB — caller will persist remotely. */
  sync?: boolean
}): Promise<{ data: { id: string }; error: null } | { data: null; error: string }> {
  const userId = await resolveSessionUserId()
  if (!userId) {
    return { data: null, error: 'You must be signed in to save a split.' }
  }

  const lifts = await getCachedLiftTypes()
  const payload: SaveSplitInput = {
    ...input.payload,
    id: input.splitId,
    dayIds: input.payload.dayIds ?? input.payload.days.map(() => crypto.randomUUID()),
  }

  const cached = buildLocalSplit({
    splitId: input.splitId,
    userId,
    payload,
    lifts,
  })

  const db = await getOfflineDb()
  const mutation: SplitMutation = {
    id: input.splitId,
    kind: input.kind,
    splitId: input.splitId,
    payload,
    syncStatus: 'pending',
    syncError: null,
    updatedAt: new Date().toISOString(),
  }
  await db.put('splits', cached)
  await db.put('splitMutations', mutation)
  notify()
  if (input.sync !== false && typeof navigator !== 'undefined' && navigator.onLine) {
    void import('@/lib/offline/sync').then((mod) => mod.queueSplitSync())
  }
  return { data: { id: input.splitId }, error: null }
}

async function ensureLiftIdViaBrowser(
  supabase: ReturnType<typeof createClient>,
  lifts: LiftType[],
  exercise: SaveSplitInput['days'][number]['exercises'][number],
): Promise<string> {
  const matched = matchLift(lifts, exercise)
  if (matched?.id && UUID_RE.test(matched.id)) return matched.id
  if (UUID_RE.test(exercise.libraryId.trim())) return exercise.libraryId.trim()

  const slug = toSlug(exercise.libraryId || exercise.name)
  const { data: rpcId, error } = await supabase.rpc('ensure_lift_type', {
    p_slug: slug,
    p_name: exercise.name.trim(),
    p_muscle_group: exercise.muscles[0] ?? null,
    p_image_url: exercise.image,
  })
  if (!error && rpcId) return rpcId as string
  throw new Error(
    error?.message || `Could not resolve lift type for “${exercise.name}”.`,
  )
}

/** Upsert the queued split with the browser session (cookies may still be stale). */
async function saveSplitViaBrowser(
  mutation: SplitMutation,
): Promise<{ data: { id: string }; error: null } | { data: null; error: string }> {
  try {
  const supabase = createClient()
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!sessionData.session?.access_token || !userId) {
    return {
      data: null,
      error: 'Waiting to reconnect before syncing this split.',
    }
  }

  const payload = mutation.payload
  const name = payload.name.trim()
  if (!name) return { data: null, error: 'Give your split a name before saving.' }

  try {
    await upsertRows('splits', {
      id: mutation.splitId,
      user_id: userId,
      name,
      description: payload.description?.trim() || null,
      days_per_week: payload.daysPerWeek,
      is_system: false,
      is_shared: false,
    })
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Could not save that split.',
    }
  }

  const db = await getOfflineDb()
  const cached = await db.get('splits', mutation.splitId)
  const lifts = await getCachedLiftTypes()
  const dayIds =
    payload.dayIds ??
    cached?.row.split_days?.map((day) => day.id) ??
    payload.days.map(() => crypto.randomUUID())

  const { data: oldDays } = await supabase
    .from('split_days')
    .select('id')
    .eq('split_id', mutation.splitId)
  const oldDayIds = (oldDays ?? []).map((row: { id: string }) => row.id)
  if (oldDayIds.length > 0) {
    await supabase.from('split_day_exercises').delete().in('split_day_id', oldDayIds)
    await supabase.from('split_days').delete().eq('split_id', mutation.splitId)
  }

  for (let dayIndex = 0; dayIndex < payload.days.length; dayIndex += 1) {
    const day = payload.days[dayIndex]
    const cachedDay = cached?.row.split_days?.[dayIndex]
    const dayId = dayIds[dayIndex] ?? cachedDay?.id ?? crypto.randomUUID()
    try {
      await upsertRows('split_days', {
        id: dayId,
        split_id: mutation.splitId,
        name: day.name.trim() || `Day ${dayIndex + 1}`,
        subtitle: day.subtitle?.trim() || null,
        day_order: dayIndex + 1,
      })
    } catch (err) {
      return {
        data: null,
        error:
          err instanceof Error ? err.message : 'Could not save a training day.',
      }
    }

    const exerciseRows: Record<string, unknown>[] = []
    for (let exIndex = 0; exIndex < day.exercises.length; exIndex += 1) {
      const exercise = day.exercises[exIndex]
      let liftTypeId: string
      try {
        liftTypeId = await ensureLiftIdViaBrowser(supabase, lifts, exercise)
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err.message : 'Could not resolve lift type.',
        }
      }
      const cachedEx = cachedDay?.split_day_exercises?.[exIndex]
      exerciseRows.push({
        id: cachedEx?.id ?? crypto.randomUUID(),
        split_day_id: dayId,
        lift_type_id: liftTypeId,
        target_sets: Math.max(1, exercise.sets || 3),
        target_reps_min: parseTargetReps(exercise.reps).min,
        target_reps_max: parseTargetReps(exercise.reps).max,
        exercise_order: exIndex + 1,
      })
    }
    if (exerciseRows.length > 0) {
      try {
        await upsertRows('split_day_exercises', exerciseRows)
      } catch (err) {
        return {
          data: null,
          error:
            err instanceof Error ? err.message : 'Could not save an exercise.',
        }
      }
    }
  }

  return { data: { id: mutation.splitId }, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Could not save that split.',
    }
  }
}

export async function recoverStaleSplitMutations(maxAgeMs = 45_000) {
  const db = await getOfflineDb()
  const all = await db.getAll('splitMutations')
  const cutoff = Date.now() - maxAgeMs
  for (const row of all) {
    if (
      row.syncStatus === 'syncing' &&
      new Date(row.updatedAt).getTime() < cutoff
    ) {
      await db.put('splitMutations', {
        ...row,
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
      })
    }
  }
}

export async function syncSplitMutation(mutation: SplitMutation): Promise<void> {
  const db = await getOfflineDb()
  await db.put('splitMutations', {
    ...mutation,
    syncStatus: 'syncing',
    syncError: null,
    updatedAt: new Date().toISOString(),
  })

  let result = await saveSplitViaBrowser(mutation)
  if (result.error) {
    result =
      mutation.kind === 'update'
        ? await updateCustomSplit(mutation.splitId, mutation.payload)
        : await saveCustomSplit(mutation.payload)
  }

  if (result.error) {
    await db.put('splitMutations', {
      ...mutation,
      syncStatus: 'pending',
      syncError: result.error,
      updatedAt: new Date().toISOString(),
    })
    throw new Error(result.error)
  }

  await db.put('splitMutations', {
    ...mutation,
    syncStatus: 'synced',
    syncError: null,
    updatedAt: new Date().toISOString(),
  })
  notify()
}

export async function flushSplitMutations(): Promise<{ synced: number; failed: number }> {
  await recoverStaleSplitMutations()
  await enqueueMissingSplitMutations()
  const pending = await listUnsyncedSplitMutations()
  let synced = 0
  let failed = 0
  for (const mutation of pending) {
    try {
      await syncSplitMutation(mutation)
      synced += 1
    } catch {
      failed += 1
    }
  }
  return { synced, failed }
}
