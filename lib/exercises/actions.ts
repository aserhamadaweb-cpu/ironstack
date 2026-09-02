'use server'

import { getExerciseById } from '@/lib/exercises/catalog'
import { resolveLibraryExercise } from '@/lib/exercise-library.server'
import type { Exercise } from '@/lib/exercises/types'

export type ExerciseDetailDto = Omit<Exercise, 'source'>

export async function fetchExerciseDetail(
  id: string,
  name?: string,
): Promise<ExerciseDetailDto | null> {
  const library = resolveLibraryExercise(name?.trim() ?? '', id)
  const catalogId = library?.id ?? id.trim()
  const exercise = getExerciseById(catalogId)
  if (!exercise) return null
  const { source, ...rest } = exercise
  void source
  return rest
}
