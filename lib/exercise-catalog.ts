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
  bodyPart?: string | null
  target?: string | null
  equipment?: string | null
  /** Details page for Gym visual catalog ids (0001). Null for lift_types UUIDs. */
  detailsHref?: string | null
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
  pectorals: 'Chest',
  delts: 'Shoulders',
  deltoids: 'Shoulders',
  'rear deltoids': 'Shoulders',
  'upper back': 'Back',
  spine: 'Back',
  rhomboids: 'Back',
  'latissimus dorsi': 'Back',
  trapezius: 'Traps',
  abs: 'Abs',
  obliques: 'Abs',
  'cardiovascular system': 'Cardio',
  cardio: 'Cardio',
  'levator scapulae': 'Neck',
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
  equipment?: string | null
  target?: string | null
  sort: ExerciseSort
}

function searchHaystack(item: ExerciseCatalogItem): string {
  return [
    item.name,
    item.muscleGroup,
    item.category,
    item.bodyPart,
    item.target,
    item.equipment,
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterAndSortExercises(
  items: ExerciseCatalogItem[],
  query: ExerciseCatalogQuery,
): ExerciseCatalogItem[] {
  const q = query.search.trim().toLowerCase()
  const filtered = items.filter((item) => {
    if (q && !searchHaystack(item).includes(q)) return false
    if (query.muscles.length > 0) {
      const muscle = item.muscleGroup
      if (!muscle || !query.muscles.includes(muscle)) return false
    }
    if (query.category) {
      const cat = normalizeCategory(item.category ?? item.bodyPart)
      if (cat !== query.category) return false
    }
    if (query.equipment) {
      const equipment = (item.equipment ?? item.tags?.[0] ?? '').toLowerCase()
      if (equipment !== query.equipment.toLowerCase()) return false
    }
    if (query.target) {
      const target = (item.target ?? '').toLowerCase()
      if (target !== query.target.toLowerCase()) return false
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
    const cat = normalizeCategory(item.category ?? item.bodyPart)
    if (cat) set.add(cat)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function collectEquipment(items: ExerciseCatalogItem[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const value = (item.equipment ?? item.tags?.[0] ?? '').trim()
    if (value) set.add(value)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function collectTargets(items: ExerciseCatalogItem[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const value = item.target?.trim()
    if (value) set.add(value)
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
    bodyPart?: string | null
    target?: string | null
    muscleGroup?: string | null
  },
): ExerciseCatalogItem {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: normalizeMuscleGroup(
      exercise.muscles[0] ?? exercise.muscleGroup ?? null,
    ),
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
