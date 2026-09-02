export type { Exercise, ExerciseSlim, SourceExercise } from '@/lib/exercises/types'
export {
  loadExerciseCatalog,
  loadSlimExercises,
  loadSourceExercises,
  getExerciseById,
} from '@/lib/exercises/catalog'
export { exerciseToLibraryExercise, exerciseToSlim } from '@/lib/exercises/adapters'
export { animationGifFor } from '@/lib/exercises/animation-clips'
