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

const VARIANT_PENALTY =
  /alternate|one leg|twisting|calf raise|side pov|back pov|on knees|jump step|rear lunge|full range of motion|parallel grip|reverse grip|close grip|wide grip|behind head|on leg press machine|twin handle|inverse|assisted inverse/i

const SHORT_QUERY_NOISE =
  /\bbench\b|\bfront\b|\bsplit\b|\bband\b|\bsingle\b|\bjump\b|\bzercher\b|\bsupport\b|\bpull-up cable\b/i

/** Common coach/model shorthand → catalog search query. */
const EXERCISE_NAME_ALIASES: Record<string, string> = {
  row: 'bent over row',
  'barbell row': 'bent over row',
  squat: 'barbell full squat',
  'barbell squat': 'barbell full squat',
  'bench press': 'barbell bench press',
  'overhead press': 'barbell seated overhead press',
  ohp: 'barbell seated overhead press',
  'military press': 'barbell seated overhead press',
  deadlift: 'barbell deadlift',
  'lat pulldown': 'cable lat pulldown',
  pulldown: 'cable lat pulldown',
  'leg press': 'sled 45',
  'leg curl': 'lever lying leg curl',
  'triceps pushdown': 'cable triceps pushdown',
  'tricep pushdown': 'cable triceps pushdown',
  'lateral raise': 'dumbbell lateral raise',
  'face pull': 'cable face pull',
  'calf raise': 'lever standing calf raise',
}

/** Canonical catalog source ids for common shorthand (when name search is ambiguous). */
const EXERCISE_ID_ALIASES: Record<string, string> = {
  'leg press': '0739',
  'lat pulldown': '2330',
  pulldown: '2330',
  row: '0027',
  'barbell row': '0027',
  squat: '0043',
  'barbell squat': '0043',
}

export function aliasSearchQuery(raw: string): string {
  const key = normalizeKey(raw)
  return EXERCISE_NAME_ALIASES[key] ?? raw
}

export function resolveExerciseIdAlias(raw: string): string | null {
  const key = normalizeKey(raw)
  return EXERCISE_ID_ALIASES[key] ?? null
}

function isShortQuery(key: string): boolean {
  return key.split(' ').filter(Boolean).length <= 2
}

/** Pick the best catalog row when search returns multiple hits (AI often uses shorthand names). */
export function pickBestCatalogMatch(
  query: string,
  hits: Array<{ id: string; name: string; equipment: string }>,
  options?: { homeOnly?: boolean },
): { id: string; name: string } | null {
  if (hits.length === 0) return null
  const key = normalizeKey(query)
  if (!key) return hits[0] ?? null

  const exact = hits.find((hit) => normalizeKey(hit.name) === key)
  if (exact) return exact

  const queryTokens = key.split(' ').filter((token) => token.length > 1)
  const homeOnly = options?.homeOnly ?? false
  let best: { hit: (typeof hits)[0]; score: number } | null = null

  for (const hit of hits) {
    const nameKey = normalizeKey(hit.name)
    let score = 0

    if (nameKey.startsWith(key)) score += 40
    if (nameKey.includes(key)) score += 25
    if (queryTokens.length > 0 && queryTokens.every((token) => nameKey.includes(token))) {
      score += 60
    }

    const eq = hit.equipment.toLowerCase()
    if (homeOnly) {
      if (eq.includes('body weight')) score += 30
      else if (eq.includes('dumbbell')) score += 25
      else if (eq.includes('band')) score += 15
      else if (eq.includes('barbell') || eq.includes('sled') || eq.includes('leverage')) {
        score -= 25
      }
    } else {
      if (eq.includes('barbell')) score += 30
      else if (eq.includes('smith')) score += 20
      else if (eq.includes('dumbbell')) score += 15
      else if (eq.includes('cable')) score += 12
      else if (eq.includes('leverage') || eq.includes('sled')) score += 8
      else if (eq.includes('band')) score -= 15
    }

    if (VARIANT_PENALTY.test(hit.name)) score -= 25

    if (isShortQuery(key)) {
      if (SHORT_QUERY_NOISE.test(hit.name) && !SHORT_QUERY_NOISE.test(query)) {
        score -= 35
      }
      if (
        nameKey === `barbell ${key}` ||
        nameKey === `barbell full ${key}` ||
        nameKey === `cable ${key}` ||
        nameKey === `lever lying ${key}`
      ) {
        score += 35
      }
    }

    score -= Math.max(0, hit.name.length - query.length) * 0.15

    if (!best || score > best.score) {
      best = { hit, score }
    }
  }

  if (!best || best.score < 30) return null
  return best.hit
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
