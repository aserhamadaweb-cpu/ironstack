import { resolveLibraryExercise } from '@/lib/exercise-library.server'
import { getExerciseById } from '@/lib/exercises/catalog'
import type { Exercise } from '@/lib/exercises/types'

export type ExerciseDetailDto = Omit<Exercise, 'source'>

/** Resolve catalog id + full exercise row for detail views. */
export function resolveExerciseDetail(
  id: string,
  name?: string,
): ExerciseDetailDto | null {
  const library = resolveLibraryExercise(name?.trim() ?? '', id)
  const catalogId = library?.id ?? id.trim()
  const exercise = getExerciseById(catalogId)
  if (!exercise) return null
  const { source, ...rest } = exercise
  void source
  return rest
}
