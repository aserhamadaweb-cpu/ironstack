'use server'

import { createClient, getAuthIdentity } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import { logServerError } from '@/lib/log'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import { loadIdentityMapFile } from '@/lib/exercises/catalog'
import { liftSlugForLibraryExercise } from '@/lib/exercises/identity'
import { parseTargetReps } from '@/lib/split-reps'

export type SaveSplitDayInput = {
  name: string
  subtitle?: string | null
  exercises: Array<{
    libraryId: string
    name: string
    muscles: string[]
    image: string | null
    sets: number
    equipment?: string
    /** Exercise library category, e.g. cardio, strength. */
    category?: string | null
    /** Target reps or cardio duration minutes, e.g. "8–12" or "30". */
    reps?: string
  }>
}

export type SaveSplitInput = {
  /** Client-generated UUID so offline creates can upsert without duplicates. */
  id?: string
  /** Client-generated day UUIDs, parallel to `days`. */
  dayIds?: string[]
  name: string
  description?: string | null
  category?: string | null
  daysPerWeek: number
  days: SaveSplitDayInput[]
}

export type SaveSplitResult =
  | { data: { id: string }; error: null }
  | { data: null; error: string }

async function pickExistingCategory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  preferred?: string | null,
): Promise<string | null> {
  const { data } = await supabase
    .from('splits')
    .select('category')
    .not('category', 'is', null)
    .limit(40)

  const existing = (data ?? [])
    .map((row: { category: string | null }) => row.category)
    .filter((value: string | null): value is string => Boolean(value?.trim()))

  if (existing.length === 0) return null

  const preferredTrim = preferred?.trim()
  if (preferredTrim) {
    const exact = existing.find((c: string) => c === preferredTrim)
    if (exact) return exact
    const ci = existing.find(
      (c: string) => c.toLowerCase() === preferredTrim.toLowerCase(),
    )
    if (ci) return ci
  }

  return existing[0]
}

async function assertUnderSplitLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<SaveSplitResult | null> {
  const { count, error: countError } = await supabase
    .from('splits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_system', false)

  if (countError) {
    // is_system filter may fail on older schemas — retry without it.
    const retry = await supabase
      .from('splits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (retry.error) {
      console.error('[save-split] count', countError, retry.error)
      return {
        data: null,
        error: 'Could not check your split limit. Please try again.',
      }
    }
    if ((retry.count ?? 0) >= MAX_CUSTOM_SPLITS) {
      return {
        data: null,
        error: `You already have ${MAX_CUSTOM_SPLITS} custom splits. Delete one from My Splits to add another.`,
      }
    }
    return null
  }

  if ((count ?? 0) >= MAX_CUSTOM_SPLITS) {
    return {
      data: null,
      error: `You already have ${MAX_CUSTOM_SPLITS} custom splits. Delete one from My Splits to add another.`,
    }
  }
  return null
}

/**
 * Insert a user-owned splits row, using a category that already exists in the
 * table so we never invent a value that fails splits_category_check.
 */
async function insertUserSplitRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: {
    userId: string
    name: string
    description: string | null
    daysPerWeek: number
    preferredCategory?: string | null
    sourceSplitId?: string | null
    id?: string
  },
): Promise<{ id: string } | { error: string }> {
  const category = await pickExistingCategory(supabase, input.preferredCategory)

  const base: Record<string, unknown> = {
    user_id: input.userId,
    name: input.name,
    description: input.description,
    days_per_week: input.daysPerWeek,
    is_system: false,
    is_shared: false,
  }
  if (input.id) base.id = input.id
  if (input.sourceSplitId) {
    base.source_split_id = input.sourceSplitId
  }

  // Prefer a known-good category first — many live DBs enforce NOT NULL on
  // splits.category (23502). Null / omitted follow for schemas that ban
  // non-null category on user-owned rows.
  const attempts: Array<Record<string, unknown>> = []
  if (category) {
    attempts.push({ ...base, category })
  }
  attempts.push({ ...base })
  attempts.push({ ...base, category: null })

  // Fallback if source_split_id / is_shared columns are not migrated yet.
  if (input.sourceSplitId) {
    const withoutSource = { ...base }
    delete withoutSource.source_split_id
    if (category) {
      attempts.push({ ...withoutSource, category })
    }
    attempts.push(withoutSource)
    attempts.push({ ...withoutSource, category: null })
  }
  const withoutSharedFlags: Record<string, unknown> = {
    user_id: input.userId,
    name: input.name,
    description: input.description,
    days_per_week: input.daysPerWeek,
    is_system: false,
  }
  if (category) {
    attempts.push({ ...withoutSharedFlags, category })
  }
  attempts.push(withoutSharedFlags)
  attempts.push({ ...withoutSharedFlags, category: null })

  let lastError: { message?: string; code?: string } | null = null

  for (const payload of attempts) {
    const query = input.id
      ? supabase.from('splits').upsert(payload, { onConflict: 'id' })
      : supabase.from('splits').insert(payload)
    const { data, error } = await query.select('id').single()

    if (!error && data?.id) {
      return { id: data.id as string }
    }
    lastError = error
    logServerError('[save-split] split insert attempt', error)
  }

  const detail = lastError?.message ?? ''
  if (detail.toLowerCase().includes('splits_category_check')) {
    return {
      error:
        'Could not save your split — run supabase/fix-splits-category-check.sql in the Supabase SQL Editor, then try again.',
    }
  }
  if (detail.toLowerCase().includes('policy') || lastError?.code === '42501') {
    return {
      error:
        'Could not save your split — database permissions blocked the insert. Add an INSERT policy on public.splits for authenticated users.',
    }
  }
  return {
    error: detail
      ? `Could not save your split: ${detail}`
      : 'Could not save your split. Please try again.',
  }
}

type SourceDayRow = {
  name: string
  subtitle: string | null
  day_order: number
  split_day_exercises:
    | Array<{
        lift_type_id: string
        target_sets: number
        target_reps_min?: number | null
        target_reps_max?: number | null
        exercise_order: number
      }>
    | null
}

function targetsFromReps(reps?: string) {
  const parsed = parseTargetReps(reps)
  return {
    target_reps_min: parsed.min,
    target_reps_max: parsed.max,
  }
}

async function insertSplitDayExercise(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: {
    id?: string
    split_day_id: string
    lift_type_id: string
    target_sets: number
    exercise_order: number
    target_reps_min?: number | null
    target_reps_max?: number | null
  },
) {
  const { error } = await supabase.from('split_day_exercises').insert(row)
  if (
    error &&
    /target_reps/i.test(error.message ?? '') &&
    (row.target_reps_min != null || row.target_reps_max != null)
  ) {
    const { target_reps_min, target_reps_max, ...rest } = row
    void target_reps_min
    void target_reps_max
    return supabase.from('split_day_exercises').insert(rest).then((r: { error: unknown }) => r.error)
  }
  return error
}

async function copySplitTree(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  newSplitId: string,
  days: SourceDayRow[],
): Promise<SaveSplitResult | null> {
  const sorted = [...days].sort((a, b) => a.day_order - b.day_order)

  for (const day of sorted) {
    const { data: dayRow, error: dayError } = await supabase
      .from('split_days')
      .insert({
        split_id: newSplitId,
        name: day.name,
        subtitle: day.subtitle,
        day_order: day.day_order,
      })
      .select('id')
      .single()

    if (dayError || !dayRow) {
      console.error('[copySplitTree] day insert', dayError)
      await supabase.from('splits').delete().eq('id', newSplitId)
      return {
        data: null,
        error: 'Could not copy training days. Please try again.',
      }
    }

    const exercises = [...(day.split_day_exercises ?? [])].sort(
      (a, b) => a.exercise_order - b.exercise_order,
    )

    for (const exercise of exercises) {
      const exError = await insertSplitDayExercise(supabase, {
        split_day_id: dayRow.id,
        lift_type_id: exercise.lift_type_id,
        target_sets: exercise.target_sets,
        target_reps_min: exercise.target_reps_min ?? null,
        target_reps_max: exercise.target_reps_max ?? null,
        exercise_order: exercise.exercise_order,
      })

      if (exError) {
        console.error('[copySplitTree] exercise insert', exError)
        await supabase.from('splits').delete().eq('id', newSplitId)
        return {
          data: null,
          error: 'Could not copy exercises. Please try again.',
        }
      }
    }
  }

  return null
}

/**
 * Maps library categories to lift_types.category values stored in Supabase.
 * The new catalog uses body parts (chest, waist, …) which must not be written
 * as lift_types.category — those fail the check constraint.
 */
function liftCategoryFromLibrary(category: string | null | undefined): string {
  const raw = category?.trim().toLowerCase()
  if (!raw) return 'accessory'
  if (raw === 'cardio') return 'cardio'
  if (raw === 'stretching' || raw === 'plyometrics' || raw === 'accessory') {
    return 'accessory'
  }
  if (raw === 'strength' || raw === 'compound') return 'compound'
  return 'compound'
}

async function syncLiftTypeCategory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  liftTypeId: string,
  category: string | null | undefined,
): Promise<void> {
  const mapped = liftCategoryFromLibrary(category)
  if (!mapped) return
  const { error } = await supabase
    .from('lift_types')
    .update({ category: mapped })
    .eq('id', liftTypeId)
  if (error) {
    console.error('[ensureLiftTypeId] category sync', error)
  }
}

/**
 * Resolves a library exercise to a lift_types.id — looks up by slug/name first,
 * then creates a row via RPC (preferred) or direct insert.
 */
async function ensureLiftTypeId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  exercise: {
    libraryId: string
    name: string
    muscles: string[]
    image: string | null
    category?: string | null
  },
): Promise<{ id: string } | { error: string }> {
  const identity = loadIdentityMapFile()
  const mappedSlug = /^\d{4}$/.test(exercise.libraryId.trim())
    ? identity.bySourceId[exercise.libraryId.trim()]?.legacySlug
    : null
  const slug = liftSlugForLibraryExercise(
    exercise.libraryId,
    exercise.name,
    mappedSlug,
  )
  const name = exercise.name.trim()
  const muscle = exercise.muscles[0] ?? null
  const category = liftCategoryFromLibrary(exercise.category)

  const { data: bySlug } = await supabase
    .from('lift_types')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (bySlug?.id) {
    return { id: bySlug.id as string }
  }

  const { data: byName } = await supabase
    .from('lift_types')
    .select('id')
    .ilike('name', name.replace(/[%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle()

  if (byName?.id) {
    return { id: byName.id as string }
  }

  // Preferred path: SECURITY DEFINER RPC (see fix-lift-types-insert.sql).
  const { data: rpcId, error: rpcError } = await supabase.rpc('ensure_lift_type', {
    p_slug: slug,
    p_name: name,
    p_muscle_group: muscle,
    p_image_url: exercise.image,
  })

  if (!rpcError && rpcId) {
    await syncLiftTypeCategory(supabase, rpcId as string, exercise.category)
    return { id: rpcId as string }
  }

  if (rpcError) {
    console.error('[ensureLiftTypeId] rpc', rpcError)
  }

  // Fallback: direct insert (needs INSERT policy on lift_types).
  const payloads = [
    {
      slug,
      name,
      category,
      muscle_group: muscle,
      image_url: exercise.image,
      is_system: false,
      sort_order: 1000,
    },
    {
      slug,
      name,
      category,
      is_system: false,
      sort_order: 1000,
    },
    {
      slug,
      name,
      category: 'compound',
      is_system: false,
      sort_order: 1000,
    },
  ]

  let lastError: { message?: string; code?: string } | null = rpcError ?? null

  for (const payload of payloads) {
    const { data: inserted, error } = await supabase
      .from('lift_types')
      .insert(payload)
      .select('id')
      .single()

    if (!error && inserted?.id) {
      await syncLiftTypeCategory(
        supabase,
        inserted.id as string,
        exercise.category,
      )
      return { id: inserted.id as string }
    }
    lastError = error
    console.error('[ensureLiftTypeId] insert', payload, error)

    // Race: another request inserted the same slug.
    if (error?.code === '23505') {
      const { data: raced } = await supabase
        .from('lift_types')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (raced?.id) {
        await syncLiftTypeCategory(
          supabase,
          raced.id as string,
          exercise.category,
        )
        return { id: raced.id as string }
      }
    }
  }

  const detail = (lastError?.message ?? '').toLowerCase()
  if (
    detail.includes('policy') ||
    lastError?.code === '42501' ||
    detail.includes('permission') ||
    detail.includes('ensure_lift_type') ||
    detail.includes('function') ||
    detail.includes('schema cache')
  ) {
    return {
      error: `No lift type found for “${name}”. Run supabase/fix-lift-types-insert.sql in the Supabase SQL Editor, then try saving again.`,
    }
  }

  return {
    error: `Could not resolve lift type for “${name}”: ${lastError?.message ?? 'unknown error'}`,
  }
}

/** Persists a custom split + days + exercises for the signed-in athlete. */
export async function saveCustomSplit(
  input: SaveSplitInput,
): Promise<SaveSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  const supabase = await createClient()
  const { userId } = await getAuthIdentity()
  const user = userId ? { id: userId } : null

  if (!user) {
    return { data: null, error: 'You must be signed in to save a split.' }
  }

  const name = input.name.trim()
  if (!name) {
    return { data: null, error: 'Give your split a name before saving.' }
  }
  if (!input.days.length) {
    return { data: null, error: 'Add at least one training day.' }
  }
  if (input.days.every((day) => day.exercises.length === 0)) {
    return { data: null, error: 'Add at least one exercise before saving.' }
  }

  if (input.id) {
    const { data: existing } = await supabase
      .from('splits')
      .select('id')
      .eq('id', input.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing?.id) {
      return updateCustomSplit(existing.id as string, input)
    }
  }

  const limitError = await assertUnderSplitLimit(supabase, user.id)
  if (limitError) return limitError

  const split = await insertUserSplitRow(supabase, {
    userId: user.id,
    name,
    description: input.description?.trim() || null,
    daysPerWeek: input.daysPerWeek,
    preferredCategory: input.category,
    id: input.id,
  })

  if ('error' in split) {
    return { data: null, error: split.error }
  }

  // Offline sync may have already written days for this id. Replace instead of
  // inserting a second (split_id, day_order) row.
  const daysError = await replaceSplitDays(supabase, split.id, input)
  if (daysError) {
    await supabase.from('splits').delete().eq('id', split.id)
    return daysError
  }

  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard/workout')
    revalidatePath('/dashboard/home-workouts')
  } catch {
    /* Client will refresh. */
  }

  return { data: { id: split.id }, error: null }
}

async function replaceSplitDays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  splitId: string,
  input: SaveSplitInput,
): Promise<SaveSplitResult | null> {
  const { data: oldDays, error: loadDaysError } = await supabase
    .from('split_days')
    .select('id, day_order')
    .eq('split_id', splitId)

  if (loadDaysError) {
    logServerError('[replaceSplitDays] load days', loadDaysError)
    return {
      data: null,
      error: 'Could not load training days. Please try again.',
    }
  }

  const previous = (oldDays ?? []) as Array<{ id: string; day_order: number }>
  const maxOrder = Math.max(0, ...previous.map((row) => Number(row.day_order) || 0))
  const offset = Math.max(1000, maxOrder + 1000)

  if (previous.length > 0) {
    for (let i = 0; i < previous.length; i += 1) {
      const { error } = await supabase
        .from('split_days')
        .update({ day_order: offset + i + 1 })
        .eq('id', previous[i].id)
      if (error) {
        logServerError('[replaceSplitDays] shift days', error)
        for (const row of previous) {
          await supabase
            .from('split_days')
            .update({ day_order: row.day_order })
            .eq('id', row.id)
        }
        return {
          data: null,
          error: 'Could not update training days. Please try again.',
        }
      }
    }
  }

  const keepIds: string[] = []
  const restoreShift = async () => {
    for (const row of previous) {
      await supabase
        .from('split_days')
        .update({ day_order: row.day_order })
        .eq('id', row.id)
    }
    if (keepIds.length > 0) {
      const extra = keepIds.filter((id) => !previous.some((row) => row.id === id))
      if (extra.length > 0) {
        await supabase.from('split_day_exercises').delete().in('split_day_id', extra)
        await supabase.from('split_days').delete().in('id', extra)
      }
    }
  }

  for (let dayIndex = 0; dayIndex < input.days.length; dayIndex += 1) {
    const day = input.days[dayIndex]
    const dayId =
      input.dayIds?.[dayIndex] &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.dayIds[dayIndex],
      )
        ? input.dayIds[dayIndex]
        : crypto.randomUUID()
    keepIds.push(dayId)

    const payload = {
      id: dayId,
      split_id: splitId,
      name: day.name.trim() || `Day ${dayIndex + 1}`,
      subtitle: day.subtitle?.trim() || null,
      day_order: dayIndex + 1,
    }

    const { error: upsertError } = await supabase
      .from('split_days')
      .upsert(payload, { onConflict: 'id' })

    if (upsertError) {
      logServerError('[replaceSplitDays] day upsert', upsertError)
      await restoreShift()
      return {
        data: null,
        error: upsertError.message
          ? `Could not save a training day: ${upsertError.message}`
          : 'Could not save a training day. Please try again.',
      }
    }

    const { data: oldExercises } = await supabase
      .from('split_day_exercises')
      .select('id')
      .eq('split_day_id', dayId)
    const oldExerciseIds = ((oldExercises ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    )

    const createdExerciseIds: string[] = []
    for (let exIndex = 0; exIndex < day.exercises.length; exIndex += 1) {
      const exercise = day.exercises[exIndex]
      const lift = await ensureLiftTypeId(supabase, exercise)
      if ('error' in lift) {
        if (createdExerciseIds.length > 0) {
          await supabase.from('split_day_exercises').delete().in('id', createdExerciseIds)
        }
        await restoreShift()
        return { data: null, error: lift.error }
      }

      const exerciseId = crypto.randomUUID()
      const reps = targetsFromReps(exercise.reps)
      const exError = await insertSplitDayExercise(supabase, {
        id: exerciseId,
        split_day_id: dayId,
        lift_type_id: lift.id,
        target_sets: Math.max(1, exercise.sets || 3),
        target_reps_min: reps.target_reps_min,
        target_reps_max: reps.target_reps_max,
        exercise_order: exIndex + 1 + 1000,
      })

      if (exError) {
        logServerError('[replaceSplitDays] exercise insert', exError)
        if (createdExerciseIds.length > 0) {
          await supabase.from('split_day_exercises').delete().in('id', createdExerciseIds)
        }
        await restoreShift()
        return {
          data: null,
          error: (exError as { message?: string }).message
            ? `Could not save an exercise: ${(exError as { message: string }).message}`
            : 'Could not save an exercise. Please try again.',
        }
      }
      createdExerciseIds.push(exerciseId)
    }

    if (oldExerciseIds.length > 0) {
      await supabase.from('split_day_exercises').delete().in('id', oldExerciseIds)
    }
    for (let exIndex = 0; exIndex < createdExerciseIds.length; exIndex += 1) {
      await supabase
        .from('split_day_exercises')
        .update({ exercise_order: exIndex + 1 })
        .eq('id', createdExerciseIds[exIndex])
    }
  }

  const staleIds = previous
    .map((row) => row.id)
    .filter((id) => !keepIds.includes(id))
  if (staleIds.length > 0) {
    await supabase.from('split_day_exercises').delete().in('split_day_id', staleIds)
    await supabase.from('split_days').delete().in('id', staleIds)
  }

  return null
}

/** Replace an owned custom split's meta + days + exercises in place. */
export async function updateCustomSplit(
  splitId: string,
  input: SaveSplitInput,
): Promise<SaveSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  const supabase = await createClient()
  const { userId } = await getAuthIdentity()
  const user = userId ? { id: userId } : null

  if (!user) {
    return { data: null, error: 'You must be signed in to edit a split.' }
  }

  const id = splitId.trim()
  if (!id) {
    return { data: null, error: 'Missing split id.' }
  }

  const name = input.name.trim()
  if (!name) {
    return { data: null, error: 'Give your split a name before saving.' }
  }
  if (!input.days.length) {
    return { data: null, error: 'Add at least one training day.' }
  }
  if (input.days.every((day) => day.exercises.length === 0)) {
    return { data: null, error: 'Add at least one exercise before saving.' }
  }

  const { data: existing, error: loadError } = await supabase
    .from('splits')
    .select('id, user_id, is_system, category')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('is_system', false)
    .maybeSingle()

  if (loadError || !existing) {
    return { data: null, error: 'Split not found or you cannot edit it.' }
  }

  const category =
    (await pickExistingCategory(supabase, input.category ?? existing.category)) ??
    existing.category

  const { error: updateError } = await supabase
    .from('splits')
    .update({
      name,
      description: input.description?.trim() || null,
      days_per_week: input.daysPerWeek,
      category,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[updateCustomSplit] meta', updateError)
    return {
      data: null,
      error: updateError.message
        ? `Could not update split: ${updateError.message}`
        : 'Could not update that split.',
    }
  }

  const daysError = await replaceSplitDays(supabase, id, input)
  if (daysError) return daysError

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/home-workouts')
  revalidatePath('/dashboard/splits')
  revalidatePath(`/dashboard/splits/${id}`)
  revalidatePath(`/dashboard/splits/${id}/edit`)

  return { data: { id }, error: null }
}

/**
 * Clone a system / recommended split into the athlete's Your Splits (counts toward the max of 3).
 */
export async function saveRecommendedSplit(
  sourceSplitId: string,
): Promise<SaveSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to save a split.' }
  }

  const id = sourceSplitId.trim()
  if (!id) {
    return { data: null, error: 'Missing split id.' }
  }

  const limitError = await assertUnderSplitLimit(supabase, user.id)
  if (limitError) return limitError

  const { data: source, error: sourceError } = await supabase
    .from('splits')
    .select(
      `
      id, name, description, days_per_week, category,
      split_days (
        id, name, subtitle, day_order,
        split_day_exercises ( lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order )
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (sourceError || !source) {
    console.error('[saveRecommendedSplit] load source', sourceError)
    return { data: null, error: 'Could not load that recommended split.' }
  }

  // Already saved a copy of this source?
  const { data: existingBySource } = await supabase
    .from('splits')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_split_id', id)
    .maybeSingle()

  if (existingBySource?.id) {
    return { data: { id: existingBySource.id as string }, error: null }
  }

  const created = await insertUserSplitRow(supabase, {
    userId: user.id,
    name: source.name as string,
    description: (source.description as string | null) ?? null,
    daysPerWeek: Number(source.days_per_week) || 3,
    preferredCategory: source.category as string | null,
    sourceSplitId: id,
  })

  if ('error' in created) {
    return { data: null, error: created.error }
  }

  type DayRow = {
    name: string
    subtitle: string | null
    day_order: number
    split_day_exercises:
      | Array<{
          lift_type_id: string
          target_sets: number
          target_reps_min?: number | null
          target_reps_max?: number | null
          exercise_order: number
        }>
      | null
  }

  const days = (
    Array.isArray(source.split_days) ? source.split_days : []
  ) as DayRow[]

  const copyError = await copySplitTree(supabase, created.id, days)
  if (copyError) return copyError

  return { data: { id: created.id }, error: null }
}

/** Toggle whether a custom split appears on the owner's public profile. */
export async function setSplitShared(
  splitId: string,
  isShared: boolean,
): Promise<SaveSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to share a split.' }
  }

  const id = splitId.trim()
  if (!id) return { data: null, error: 'Missing split id.' }

  const { data: existing, error: loadError } = await supabase
    .from('splits')
    .select('id, user_id, is_system')
    .eq('id', id)
    .maybeSingle()

  if (loadError || !existing) {
    return { data: null, error: 'Could not find that split.' }
  }
  if (existing.user_id !== user.id || existing.is_system) {
    return { data: null, error: 'Only your custom splits can be shared.' }
  }

  const { data: updated, error } = await supabase
    .from('splits')
    .update({
      is_shared: isShared,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, is_shared')
    .maybeSingle()

  if (error) {
    console.error('[setSplitShared]', error)
    const msg = error.message.toLowerCase()
    if (msg.includes('is_shared') || msg.includes('column')) {
      return {
        data: null,
        error:
          'Sharing is not set up yet — run supabase/fix-split-sharing.sql in the Supabase SQL Editor.',
      }
    }
    return { data: null, error: 'Could not update sharing. Please try again.' }
  }

  if (!updated?.id) {
    return {
      data: null,
      error: 'Could not update sharing — split not found or access denied.',
    }
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/splits')
  revalidatePath(`/dashboard/splits/${id}`)
  revalidatePath('/dashboard/home')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.username) {
    revalidatePath(`/profile/${profile.username}`)
  }

  return { data: { id }, error: null }
}

/**
 * Full-copy a shared (or readable) split into the saver's Your Splits.
 * Marks source_split_id so the same share is not saved twice.
 */
export async function saveSharedSplit(
  sourceSplitId: string,
  options?: { shareToken?: string },
): Promise<SaveSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to save a split.' }
  }

  const id = sourceSplitId.trim()
  if (!id) return { data: null, error: 'Missing split id.' }

  const limitError = await assertUnderSplitLimit(supabase, user.id)
  if (limitError) return limitError

  const { data: already } = await supabase
    .from('splits')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_split_id', id)
    .maybeSingle()

  if (already?.id) {
    return { data: { id: already.id as string }, error: null }
  }

  const shareToken = options?.shareToken?.trim() || null
  let source: Record<string, unknown> | null = null

  if (shareToken) {
    try {
      const admin = (await import('@/lib/supabase/admin')).createAdminClient()
      const { data, error: adminError } = await admin
        .from('splits')
        .select(
          `
      id, user_id, name, description, days_per_week, category, is_shared, is_system, share_token,
      split_days (
        id, name, subtitle, day_order,
        split_day_exercises ( lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order )
      )
    `,
        )
        .eq('id', id)
        .eq('share_token', shareToken)
        .maybeSingle()
      if (adminError || !data) {
        return { data: null, error: 'Could not load that shared split.' }
      }
      source = data as Record<string, unknown>
    } catch {
      return { data: null, error: 'Could not load that shared split.' }
    }
  } else {
    const { data, error: sourceError } = await supabase
      .from('splits')
      .select(
        `
      id, user_id, name, description, days_per_week, category, is_shared, is_system,
      split_days (
        id, name, subtitle, day_order,
        split_day_exercises ( lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order )
      )
    `,
      )
      .eq('id', id)
      .maybeSingle()

    if (sourceError || !data) {
      console.error('[saveSharedSplit] load source', sourceError)
      return { data: null, error: 'Could not load that shared split.' }
    }
    source = data as Record<string, unknown>
  }

  if (source.user_id === user.id) {
    return { data: null, error: 'That split is already yours.' }
  }

  const isSystem = Boolean(source.is_system)
  const isShared = Boolean(source.is_shared)
  const hasShareToken = Boolean(
    typeof source.share_token === 'string' && source.share_token.trim(),
  )

  if (!isSystem && !isShared && !(shareToken && hasShareToken)) {
    return { data: null, error: 'That split is not shared.' }
  }

  const created = await insertUserSplitRow(supabase, {
    userId: user.id,
    name: source.name as string,
    description: (source.description as string | null) ?? null,
    daysPerWeek: Number(source.days_per_week) || 3,
    preferredCategory: source.category as string | null,
    sourceSplitId: id,
  })

  if ('error' in created) {
    return { data: null, error: created.error }
  }

  const days = (
    Array.isArray(source.split_days) ? source.split_days : []
  ) as SourceDayRow[]

  const copyError = await copySplitTree(supabase, created.id, days)
  if (copyError) return copyError

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/workout')

  return { data: { id: created.id }, error: null }
}

/** Deletes one of the signed-in athlete's custom splits. */
export async function deleteCustomSplit(
  splitId: string,
): Promise<SaveSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  try {
    const supabase = await createClient()
    const { userId } = await getAuthIdentity()
    const user = userId ? { id: userId } : null

    if (!user) {
      return { data: null, error: 'You must be signed in to delete a split.' }
    }

    const id = splitId.trim()
    if (!id) {
      return { data: null, error: 'Missing split id.' }
    }

    const { data: days } = await supabase
      .from('split_days')
      .select('id')
      .eq('split_id', id)

    const dayIds = (days ?? []).map((d) => d.id as string)
    if (dayIds.length > 0) {
      await supabase.from('split_day_exercises').delete().in('split_day_id', dayIds)
      await supabase.from('split_days').delete().eq('split_id', id)
    }

    const { data: deleted, error } = await supabase
      .from('splits')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_system', false)
      .select('id')

    if (error || !deleted?.length) {
      console.error('[deleteCustomSplit]', error)
      return { data: null, error: 'Could not delete that split. Please try again.' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_split_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.primary_split_id === id) {
      await supabase
        .from('profiles')
        .update({
          primary_split_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    try {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/dashboard/workout')
      revalidatePath('/dashboard/home-workouts')
      revalidatePath('/dashboard/splits')
      revalidatePath(`/dashboard/splits/${id}`)
    } catch {
      /* Client will refresh; a revalidate failure must not crash delete. */
    }

    return { data: { id }, error: null }
  } catch (err) {
    console.error('[deleteCustomSplit]', err)
    return {
      data: null,
      error:
        err instanceof Error
          ? err.message
          : 'Could not delete that split. Please try again.',
    }
  }
}
