import type { Exercise } from '@/lib/split-data'
import {
  splitExerciseDetailRef as buildSplitExerciseDetailRef,
  type SplitExerciseDetailRef,
} from '@/lib/exercises/detail-id'

export type { SplitExerciseDetailRef }

/** Id + name passed to exercise detail loaders from a split exercise row. */
export function splitExerciseDetailRef(
  exercise: Pick<Exercise, 'liftTypeId' | 'catalogExerciseId' | 'name'>,
): SplitExerciseDetailRef | null {
  return buildSplitExerciseDetailRef(exercise)
}
