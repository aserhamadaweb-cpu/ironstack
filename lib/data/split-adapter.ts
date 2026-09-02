import type { SplitDetailRow } from '@/lib/database.types'
import type { MuscleGroup, SplitDetail } from '@/lib/split-data'
import { formatTargetReps } from '@/lib/split-reps'

const MUSCLE_FALLBACK: MuscleGroup = 'Core'

function asMuscle(value: string | null | undefined): MuscleGroup {
  if (!value) return MUSCLE_FALLBACK
  const known: MuscleGroup[] = [
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Quads',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Core',
    'Traps',
  ]
  const match = known.find((m) => m.toLowerCase() === value.toLowerCase())
  return match ?? MUSCLE_FALLBACK
}

/**
 * Adapts a live Supabase split (with nested days/exercises/lift_types) into the
 * SplitDetail shape the existing UI components already render.
 * Uses the split UUID as `slug` so route params stay UUID-based.
 */
export function toSplitDetail(row: SplitDetailRow): SplitDetail {
  return {
    slug: row.id,
    name: row.name,
    description: row.description ?? `${row.days_per_week} days/week`,
    tag: row.category || (row.is_system ? 'System' : 'Custom'),
    daysPerWeek: row.days_per_week,
    recommended: row.is_system,
    summary: row.description ?? '',
    userId: row.user_id,
    isShared: Boolean(row.is_shared),
    isSystem: Boolean(row.is_system),
    schedule: (row.split_days ?? []).map((day) => ({
      id: day.id,
      focus: day.name,
      note: day.subtitle ?? '',
      exercises: (day.split_day_exercises ?? []).map((exercise) => ({
        id: exercise.id,
        name: exercise.lift_types?.name ?? 'Exercise',
        sets: exercise.target_sets,
        reps: formatTargetReps(
          exercise.target_reps_min,
          exercise.target_reps_max,
          exercise.lift_types?.category === 'cardio' ? '30' : '8–12',
        ),
        muscle: asMuscle(exercise.lift_types?.muscle_group),
        category: exercise.lift_types?.category ?? undefined,
        image: exercise.lift_types?.image_url ?? undefined,
        liftTypeId: exercise.lift_types?.id ?? exercise.lift_type_id,
      })),
    })),
  }
}
