import { createClient } from '@/lib/supabase/server'
import { getActiveMemories } from '@/lib/ai/memory'
import { getSplitDetail } from '@/lib/data/queries'
import { getExerciseById } from '@/lib/exercises/catalog'
import { resolveCatalogId } from '@/lib/ai/catalog-lookup'
import { formatRepsFromTargets } from '@/lib/ai/proposals'
import type { SplitProposal } from '@/lib/ai/action-types'
import { isHomeEquipment } from '@/lib/exercises/home-workouts'

export async function getUserWorkoutPreferences(userId: string) {
  const supabase = await createClient()
  const [prs, logs, memories] = await Promise.all([
    supabase
      .from('personal_records')
      .select('weight, reps, lift_type_id, lift_types(id, name, slug, muscle_group)')
      .eq('user_id', userId)
      .eq('is_current_pr', true)
      .order('weight', { ascending: false })
      .limit(20),
    supabase
      .from('lift_logs')
      .select('lift_type_id, lift_types(id, name, slug)')
      .eq('user_id', userId)
      .or('is_skipped.is.null,is_skipped.eq.false')
      .order('logged_at', { ascending: false })
      .limit(80),
    getActiveMemories(userId),
  ])

  const best = (prs.data ?? []).map((row) => {
    const lift = Array.isArray(row.lift_types) ? row.lift_types[0] : row.lift_types
    const name = (lift as { name?: string } | null)?.name ?? 'Lift'
    const slug = (lift as { slug?: string } | null)?.slug ?? ''
    const resolved = resolveCatalogId(slug).id || resolveCatalogId(name).id
    return {
      name,
      catalog_id: resolved,
      muscle_group: (lift as { muscle_group?: string } | null)?.muscle_group ?? null,
      weight_kg: Number(row.weight) || 0,
      reps: Number(row.reps) || 0,
    }
  })

  const counts = new Map<string, { name: string; catalog_id: string | null; count: number }>()
  for (const row of logs.data ?? []) {
    const lift = Array.isArray(row.lift_types) ? row.lift_types[0] : row.lift_types
    const name = (lift as { name?: string } | null)?.name ?? 'Lift'
    const slug = (lift as { slug?: string } | null)?.slug ?? ''
    const key = name
    const current = counts.get(key) ?? {
      name,
      catalog_id: resolveCatalogId(slug).id || resolveCatalogId(name).id,
      count: 0,
    }
    current.count += 1
    counts.set(key, current)
  }
  const frequent = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 15)

  return {
    has_best_exercises: best.some((row) => row.catalog_id) || frequent.some((row) => row.catalog_id),
    personal_records: best,
    frequently_logged: frequent,
    notes: memories.map((m) => ({ category: m.category, fact: m.fact })),
    hint: best.length || frequent.length
      ? 'Use catalog_id values when proposing a split. If catalog_id is null, search_exercises for a replacement.'
      : 'No saved favorites or history. Ask how many days, what equipment they have, and any must-include or avoid exercises before proposing a split.',
  }
}

export async function getUserSplitsDetailed(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('splits')
    .select('id, name, days_per_week, category, description, is_system, updated_at')
    .eq('user_id', userId)
    .eq('is_system', false)
    .order('updated_at', { ascending: false })
    .limit(3)

  if (error) return { error: 'no_data', message: error.message }
  if (!data?.length) {
    return {
      splits: [],
      max_custom_splits: 3,
      message: 'No custom splits yet.',
    }
  }

  const splits = []
  for (const row of data) {
    const detail = await getSplitDetail(row.id)
    if (!detail.data || detail.data.user_id !== userId) continue
    splits.push({
      id: row.id,
      name: row.name,
      days_per_week: row.days_per_week,
      category: row.category,
      description: row.description,
      href: `/dashboard/splits/${row.id}`,
      days: (detail.data.split_days ?? []).map((day) => ({
        name: day.name,
        exercises: (day.split_day_exercises ?? []).map((exercise) => {
          const lift = exercise.lift_types
          const name = lift?.name ?? 'Exercise'
          const catalogId =
            resolveCatalogId(lift?.slug ?? '').id || resolveCatalogId(name).id
          return {
            catalog_id: catalogId,
            name,
            sets: exercise.target_sets,
            reps: formatRepsFromTargets(
              exercise.target_reps_min,
              exercise.target_reps_max,
              lift?.category === 'cardio',
            ),
          }
        }),
      })),
    })
  }

  return { splits, max_custom_splits: 3 }
}

export async function ownedSplitToProposal(
  userId: string,
  splitId: string,
): Promise<{ ok: true; proposal: SplitProposal } | { ok: false; error: string }> {
  const detail = await getSplitDetail(splitId)
  if (!detail.data) return { ok: false, error: 'Split not found.' }
  if (detail.data.user_id !== userId || detail.data.is_system) {
    return { ok: false, error: 'You can only edit your own custom splits.' }
  }

  const days = []
  for (const day of detail.data.split_days ?? []) {
    const exercises = []
    for (const exercise of day.split_day_exercises ?? []) {
      const lift = exercise.lift_types
      const name = lift?.name ?? 'Exercise'
      const catalogId =
        resolveCatalogId(lift?.slug ?? '').id || resolveCatalogId(name).id
      if (!catalogId) {
        return {
          ok: false,
          error: `Cannot map "${name}" to the exercise catalog. Search for a replacement first.`,
        }
      }
      const catalog = getExerciseById(catalogId)
      if (!catalog) {
        return { ok: false, error: `Catalog entry ${catalogId} is missing.` }
      }
      exercises.push({
        exerciseId: catalog.sourceId,
        name: catalog.name,
        equipment: catalog.equipment,
        muscle: catalog.target || catalog.muscleGroup,
        sets: exercise.target_sets || 3,
        reps: formatRepsFromTargets(
          exercise.target_reps_min,
          exercise.target_reps_max,
          catalog.category === 'cardio',
        ),
        homeSuitable: isHomeEquipment(catalog.equipment),
      })
    }
    days.push({
      name: day.name,
      subtitle: day.subtitle,
      exercises,
    })
  }

  return {
    ok: true,
    proposal: {
      id: crypto.randomUUID(),
      kind: 'update_split',
      splitId: detail.data.id,
      name: detail.data.name,
      description: detail.data.description ?? '',
      daysPerWeek: detail.data.days_per_week,
      days,
      assumptions: [],
      questions: [],
      basedOn: 'mixed',
    },
  }
}

export async function getActiveSessionForCoach(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, split_id, split_day_id, started_at, splits(name), split_days(name)',
    )
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)

  if (error) return { error: 'no_data', message: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return { active: null, message: 'No workout in progress.' }
  }
  const split = Array.isArray(row.splits) ? row.splits[0] : row.splits
  const day = Array.isArray(row.split_days) ? row.split_days[0] : row.split_days
  const splitId = row.split_id as string | null
  return {
    active: {
      session_id: row.id,
      split_id: splitId,
      split_name: (split as { name?: string } | null)?.name ?? null,
      day_name: (day as { name?: string } | null)?.name ?? null,
      started_at: row.started_at,
      resume_href: splitId ? `/dashboard/splits/${splitId}/session` : '/dashboard/workout',
    },
  }
}

export async function getWorkoutHistorySummary(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, splits(name)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(8)

  if (error) return { error: 'no_data', message: error.message }
  if (!data?.length) {
    return { sessions: [], message: 'No completed workouts in history yet.' }
  }

  return {
    sessions: data.map((row) => {
      const split = Array.isArray(row.splits) ? row.splits[0] : row.splits
      return {
        id: row.id,
        date: row.finished_at ?? row.started_at,
        duration_seconds: row.duration_seconds,
        volume_kg: Number(row.total_volume) || 0,
        sets: row.total_sets_completed,
        split: (split as { name?: string } | null)?.name ?? null,
        href: `/dashboard/sessions/${row.id}`,
      }
    }),
  }
}
