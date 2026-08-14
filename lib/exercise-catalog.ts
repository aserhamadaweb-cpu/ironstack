import { MUSCLE_FILTERS } from '@/lib/exercise-library'

export type ExerciseCatalogItem = {
  id: string
  name: string
  /** Normalized Title Case label, e.g. "Chest". */
  muscleGroup: string | null
  category: string | null
  imageUrl?: string | null
  /** Extra display tags (equipment, etc.). */
  tags?: string[]
  /** Opaque original payload for callers that need it. */
  source?: unknown
}

export type ExerciseSort = 'name-asc' | 'muscle-asc'

export const EXERCISE_SORT_OPTIONS: Array<{
  id: ExerciseSort
  labelKey: 'sortName' | 'sortMuscle'
}> = [
  { id: 'name-asc', labelKey: 'sortName' },
  { id: 'muscle-asc', labelKey: 'sortMuscle' },
]

export const EXERCISE_MUSCLE_FILTERS = MUSCLE_FILTERS

/** Raw DB / dataset muscle tags → Title Case filter labels. */
const MUSCLE_NORMALIZE: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  quadriceps: 'Quads',
  legs: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  abdominals: 'Abs',
  core: 'Abs',
  forearms: 'Forearms',
  traps: 'Traps',
  neck: 'Neck',
  abductors: 'Abductors',
  adductors: 'Adductors',
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normalizeMuscleGroup(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null
  const key = raw.trim().toLowerCase()
  return MUSCLE_NORMALIZE[key] ?? titleCase(raw.trim())
}

export function normalizeCategory(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null
  return raw.trim().toLowerCase()
}

export function formatCategoryLabel(category: string) {
  return category
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export type ExerciseCatalogQuery = {
  search: string
  muscles: string[]
  category: string | null
  sort: ExerciseSort
}

export function filterAndSortExercises(
  items: ExerciseCatalogItem[],
  query: ExerciseCatalogQuery,
): ExerciseCatalogItem[] {
  const q = query.search.trim().toLowerCase()
  const filtered = items.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) return false
    if (query.muscles.length > 0) {
      const muscle = item.muscleGroup
      if (!muscle || !query.muscles.includes(muscle)) return false
    }
    if (query.category) {
      const cat = normalizeCategory(item.category)
      if (cat !== query.category) return false
    }
    return true
  })

  filtered.sort((a, b) => {
    if (query.sort === 'muscle-asc') {
      const am = a.muscleGroup ?? 'ZZZ'
      const bm = b.muscleGroup ?? 'ZZZ'
      const byMuscle = am.localeCompare(bm)
      if (byMuscle !== 0) return byMuscle
    }
    return a.name.localeCompare(b.name)
  })

  return filtered
}

export function collectCategories(items: ExerciseCatalogItem[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const cat = normalizeCategory(item.category)
    if (cat) set.add(cat)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function libraryToCatalogItem(
  exercise: {
    id: string
    name: string
    muscles: string[]
    equipment?: string
    category?: string | null
    image: string | null
  },
): ExerciseCatalogItem {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: normalizeMuscleGroup(exercise.muscles[0] ?? null),
    category: normalizeCategory(exercise.category),
    imageUrl: exercise.image,
    tags: exercise.equipment ? [exercise.equipment] : [],
    source: exercise,
  }
}

export function liftTypeToCatalogItem(lift: {
  id: string
  name: string
  muscle_group?: string | null
  category?: string | null
  image_url?: string | null
}): ExerciseCatalogItem {
  return {
    id: lift.id,
    name: lift.name,
    muscleGroup: normalizeMuscleGroup(lift.muscle_group),
    category: normalizeCategory(lift.category),
    imageUrl: lift.image_url ?? null,
    source: lift,
  }
}
