import {
  filterAndSortExercises,
  libraryToCatalogItem,
  normalizeMuscleGroup,
  type ExerciseCatalogItem,
} from '@/lib/exercise-catalog'
import { exerciseToLibraryExercise } from '@/lib/exercises/adapters'
import { getExerciseById, loadExerciseCatalog } from '@/lib/exercises/catalog'
import { isHomeEquipment } from '@/lib/exercises/home-workouts'
import { normalizeKey } from '@/lib/exercises/normalizers'
import type { LibraryExercise } from '@/lib/exercise-library'

let byNormalizedName: Map<string, string[]> | null = null
let catalogItemsCache: ExerciseCatalogItem[] | null = null

function catalogItems(): ExerciseCatalogItem[] {
  if (!catalogItemsCache) {
    catalogItemsCache = loadExerciseCatalog().map((exercise) =>
      libraryToCatalogItem(exerciseToLibraryExercise(exercise)),
    )
  }
  return catalogItemsCache
}

function nameIndex() {
  if (byNormalizedName) return byNormalizedName
  const map = new Map<string, string[]>()
  for (const exercise of loadExerciseCatalog()) {
    const key = normalizeKey(exercise.name)
    const ids = map.get(key) ?? []
    ids.push(exercise.sourceId)
    map.set(key, ids)
  }
  byNormalizedName = map
  return map
}

export function catalogExerciseToLibrary(id: string): LibraryExercise | null {
  const exercise = getExerciseById(id)
  if (!exercise) return null
  return exerciseToLibraryExercise(exercise)
}

export function resolveCatalogId(raw: string): {
  id: string | null
  matches: Array<{ id: string; name: string }>
} {
  const trimmed = raw.trim()
  if (!trimmed) return { id: null, matches: [] }
  const padded = /^\d{1,4}$/.test(trimmed) ? trimmed.padStart(4, '0') : trimmed
  const direct = getExerciseById(trimmed) ?? getExerciseById(padded)
  if (direct) return { id: direct.sourceId, matches: [] }

  const key = normalizeKey(trimmed)
  const ids = nameIndex().get(key) ?? []
  if (ids.length === 1) return { id: ids[0], matches: [] }
  if (ids.length > 1) {
    return {
      id: null,
      matches: ids.slice(0, 8).map((id) => {
        const row = getExerciseById(id)
        return { id, name: row?.name ?? id }
      }),
    }
  }
  return { id: null, matches: [] }
}

export function searchCatalogExercises(input: {
  query?: string
  muscle?: string
  equipment?: string
  homeOnly?: boolean
  limit?: number
}): Array<{
  id: string
  name: string
  equipment: string
  muscle: string | null
  bodyPart: string | null
  homeSuitable: boolean
}> {
  const muscle = normalizeMuscleGroup(input.muscle)
  let items: ExerciseCatalogItem[] = filterAndSortExercises(catalogItems(), {
    search: input.query?.trim() ?? '',
    muscles: muscle ? [muscle] : [],
    category: null,
    equipment: input.equipment?.trim() || null,
    sort: 'name-asc',
  })
  if (input.homeOnly) {
    items = items.filter((item) => isHomeEquipment(item.equipment))
  }
  const limit = Math.min(20, Math.max(1, Math.floor(input.limit ?? 12)))
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    name: item.name,
    equipment: item.equipment ?? 'None',
    muscle: item.muscleGroup,
    bodyPart: item.bodyPart ?? null,
    homeSuitable: isHomeEquipment(item.equipment),
  }))
}

export function exerciseDetailsForCoach(id: string) {
  const resolved = resolveCatalogId(String(id ?? ''))
  if (!resolved.id) {
    return { error: 'not_found', message: `No catalog exercise with id "${id}".` }
  }
  const exercise = getExerciseById(resolved.id)
  if (!exercise) return { error: 'not_found', message: `No catalog exercise with id "${id}".` }
  const steps = exercise.instructionSteps.en?.slice(0, 4) ?? []
  return {
    id: exercise.sourceId,
    name: exercise.name,
    equipment: exercise.equipment,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    muscleGroup: exercise.muscleGroup,
    secondaryMuscles: exercise.secondaryMuscles,
    homeSuitable: isHomeEquipment(exercise.equipment),
    detailsPath: `/dashboard/exercises/${exercise.sourceId}`,
    instructionPreview: steps,
  }
}
