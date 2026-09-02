import type { Exercise } from '@/lib/split-data'

export type SplitExerciseDetailRef = {
  id: string
  name: string
}

/** Id + name passed to `fetchExerciseDetail` from a split exercise row. */
export function splitExerciseDetailRef(
  exercise: Pick<Exercise, 'liftTypeId' | 'catalogExerciseId' | 'name'>,
): SplitExerciseDetailRef | null {
  const name = exercise.name?.trim()
  if (!name) return null
  const id =
    exercise.catalogExerciseId?.trim() ||
    exercise.liftTypeId?.trim() ||
    name
  return { id, name }
}
