import { gifUrlFromImageUrl, localImageUrlFromSource } from '@/lib/exercises/paths'

/** Slimmed-down exercise entry sent to the client (no instructions etc.). */
export type LibraryExercise = {
  id: string
  name: string
  /** Display labels, e.g. "Chest", "Quads". */
  muscles: string[]
  equipment: string
  level: string
  /** Dataset category, e.g. "waist", "chest", or legacy "strength". */
  category: string | null
  /** Full thumbnail URL, or null when the entry has no images. */
  image: string | null
  /** Looping demo GIF from the same catalog media id. */
  gifUrl?: string | null
  bodyPart?: string | null
  target?: string | null
  muscleGroup?: string | null
  /** Existing lift_types.slug when this catalog row matched a previously seeded exercise. */
  legacySlug?: string | null
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  pectorals: 'Chest',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  'upper back': 'Back',
  spine: 'Back',
  shoulders: 'Shoulders',
  delts: 'Shoulders',
  deltoids: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quads',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abdominals: 'Abs',
  abs: 'Abs',
  core: 'Abs',
  forearms: 'Forearms',
  traps: 'Traps',
  trapezius: 'Traps',
  neck: 'Neck',
  'levator scapulae': 'Neck',
  abductors: 'Abductors',
  adductors: 'Adductors',
  'cardiovascular system': 'Cardio',
}

export type RawLibraryExercise = {
  id: string
  name: string
  primaryMuscles?: string[]
  equipment?: string | null
  level?: string
  category?: string | null
  images?: string[]
  image?: string | null
  bodyPart?: string | null
  target?: string | null
  muscleGroup?: string | null
  secondaryMuscles?: string[]
  muscles?: string[]
  legacySlug?: string | null
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function localOrRemoteImage(exercise: RawLibraryExercise): string | null {
  if (exercise.image?.startsWith('/') || exercise.image?.startsWith('http')) {
    if (exercise.image.includes('yuhonas/free-exercise-db')) return null
    return exercise.image
  }
  if (exercise.image?.startsWith('images/')) {
    return localImageUrlFromSource(exercise.image)
  }
  if (exercise.images?.[0]) {
    const first = exercise.images[0]
    if (first.startsWith('/') || first.startsWith('http')) {
      if (first.includes('yuhonas/free-exercise-db')) return null
      return first
    }
    if (first.startsWith('images/') || /^\d{4}-/.test(first)) {
      return localImageUrlFromSource(
        first.startsWith('images/') ? first : `images/${first}`,
      )
    }
  }
  return null
}

export function rawToLibraryExercise(exercise: RawLibraryExercise): LibraryExercise {
  const muscleSource =
    exercise.muscles?.length
      ? exercise.muscles
      : exercise.primaryMuscles?.length
        ? exercise.primaryMuscles
        : exercise.target
          ? [exercise.target]
          : ['other']
  return {
    id: exercise.id,
    name: exercise.name,
    muscles: [
      ...new Set(
        muscleSource.map((muscle) => MUSCLE_LABELS[muscle] ?? titleCase(muscle)),
      ),
    ],
    equipment: titleCase(exercise.equipment ?? 'None'),
    level: titleCase(exercise.level ?? ''),
    category: exercise.category?.trim().toLowerCase() || null,
    image: localOrRemoteImage(exercise),
    gifUrl: gifUrlFromImageUrl(localOrRemoteImage(exercise)),
    bodyPart: exercise.bodyPart ?? null,
    target: exercise.target ?? null,
    muscleGroup: exercise.muscleGroup ?? null,
    legacySlug: exercise.legacySlug ?? null,
  }
}

export function parseExerciseDataset(raw: unknown): LibraryExercise[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => rawToLibraryExercise(row as RawLibraryExercise))
}

export function liftTypeToLibraryExercise(lift: {
  id: string
  slug: string
  name: string
  category: string
  image_url: string | null
  muscle_group: string | null
}): LibraryExercise {
  const muscle = lift.muscle_group?.trim()
  return {
    id: lift.slug || lift.id,
    name: lift.name,
    muscles: muscle ? [muscle] : [],
    equipment: 'None',
    level: '',
    category: lift.category || null,
    image: lift.image_url,
    gifUrl: gifUrlFromImageUrl(lift.image_url),
  }
}
/** Filter chips shown in the Exercise Library. */
export const MUSCLE_FILTERS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Forearms',
  'Traps',
  'Neck',
  'Cardio',
] as const

