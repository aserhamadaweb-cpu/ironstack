import type { LibraryExercise } from '@/lib/exercise-library'
import type { SourceExercise } from '@/lib/exercises/types'
import type { ExerciseCatalogItem } from '@/lib/exercise-catalog'
import { normalizeCategory, normalizeMuscleGroup } from '@/lib/exercise-catalog'
import type { Exercise, ExerciseSlim } from '@/lib/exercises/types'
import { muscleDisplayLabel, titleCase } from '@/lib/exercises/normalizers'
import { gifUrlFromImageUrl } from '@/lib/exercises/paths'

/** Minimal catalog row from the offline slim JSON bundle. */
export function libraryExerciseToCatalogExercise(lib: LibraryExercise): Exercise {
  const equipment = (lib.equipment ?? 'body weight').toLowerCase()
  const stubSource: SourceExercise = {
    id: lib.id,
    name: lib.name,
    category: lib.category ?? lib.bodyPart ?? '',
    body_part: lib.bodyPart ?? '',
    equipment,
    instructions: {},
    instruction_steps: {},
    muscle_group: lib.muscleGroup ?? '',
    secondary_muscles: [],
    target: lib.target ?? '',
    media_id: '',
    image: lib.image ?? '',
    gif_url: lib.gifUrl ?? '',
    attribution: '',
    created_at: '',
  }
  return {
    sourceId: lib.id,
    name: lib.name,
    category: lib.category ?? lib.bodyPart ?? '',
    bodyPart: lib.bodyPart ?? '',
    target: lib.target ?? '',
    muscleGroup: lib.muscleGroup ?? '',
    secondaryMuscles: [],
    equipment,
    instructions: {},
    instructionSteps: {},
    image: lib.image ?? '',
    gifUrl: lib.gifUrl ?? gifUrlFromImageUrl(lib.image) ?? '',
    mediaId: '',
    attribution: '',
    createdAt: '',
    legacySlug: lib.legacySlug ?? null,
    source: stubSource,
  }
}

export function exerciseToSlim(exercise: Exercise): ExerciseSlim {
  return {
    id: exercise.sourceId,
    name: exercise.name,
    category: exercise.category,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    muscleGroup: exercise.muscleGroup,
    secondaryMuscles: [...exercise.secondaryMuscles],
    equipment: exercise.equipment,
    image: exercise.image,
    mediaId: exercise.mediaId,
    legacySlug: exercise.legacySlug,
  }
}

export function exerciseToLibraryExercise(exercise: Exercise): LibraryExercise {
  const muscles = [
    ...new Set(
      [exercise.target, exercise.muscleGroup, ...exercise.secondaryMuscles]
        .filter(Boolean)
        .map((value) => muscleDisplayLabel(value)),
    ),
  ]
  return {
    id: exercise.sourceId,
    name: exercise.name,
    muscles: muscles.length ? muscles : ['Other'],
    equipment: titleCase(exercise.equipment || 'None'),
    level: '',
    category: exercise.category || null,
    image: exercise.image,
    gifUrl: exercise.gifUrl,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    muscleGroup: exercise.muscleGroup,
    legacySlug: exercise.legacySlug,
  }
}

export function slimToLibraryExercise(slim: ExerciseSlim): LibraryExercise {
  const muscles = [
    ...new Set(
      [slim.target, slim.muscleGroup, ...slim.secondaryMuscles]
        .filter(Boolean)
        .map((value) => muscleDisplayLabel(value)),
    ),
  ]
  return {
    id: slim.id,
    name: slim.name,
    muscles: muscles.length ? muscles : ['Other'],
    equipment: titleCase(slim.equipment || 'None'),
    level: '',
    category: slim.category || null,
    image: slim.image,
    gifUrl: gifUrlFromImageUrl(slim.image),
    bodyPart: slim.bodyPart,
    target: slim.target,
    muscleGroup: slim.muscleGroup,
    legacySlug: slim.legacySlug,
  }
}

export function libraryToCatalogItemFromExercise(
  exercise: LibraryExercise,
): ExerciseCatalogItem {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: normalizeMuscleGroup(exercise.muscles[0] ?? exercise.muscleGroup ?? null),
    category: normalizeCategory(exercise.category ?? exercise.bodyPart),
    imageUrl: exercise.image,
    tags: exercise.equipment ? [exercise.equipment] : [],
    bodyPart: exercise.bodyPart ?? exercise.category ?? null,
    target: exercise.target ?? null,
    equipment: exercise.equipment ?? null,
    detailsHref: /^\d{4}$/.test(exercise.id)
      ? `/dashboard/exercises/${exercise.id}`
      : null,
    source: exercise,
  }
}
