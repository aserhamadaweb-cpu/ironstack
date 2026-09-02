'use server'

import type { Exercise } from '@/lib/exercises/types'
import { resolveExerciseDetail } from '@/lib/exercises/resolve-detail'

export type ExerciseDetailDto = Omit<Exercise, 'source'>

export async function fetchExerciseDetail(
  id: string,
  name?: string,
): Promise<ExerciseDetailDto | null> {
  return resolveExerciseDetail(id, name)
}
