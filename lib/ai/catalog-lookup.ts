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
  'calf raise': 'lever standing calf raise',
  // Word-order / plural variants the model often invents.
  'seated cable row': 'cable seated row',
  'seated cable rows': 'cable seated row',
  'cable rows': 'cable seated row',
  'cable row': 'cable seated row',
  'dumbbell row': 'dumbbell bent over row',
  'pull up': 'pull ups',
  'pull-up': 'pull ups',
  'chin up': 'chin ups',
  rdl: 'romanian deadlift',
  'romanian deadlift': 'romanian deadlift',
  'skull crusher': 'barbell lying triceps extension skull crusher',
  'skull crushers': 'barbell lying triceps extension skull crusher',
  skullcrusher: 'barbell lying triceps extension skull crusher',
  skullcrushers: 'barbell lying triceps extension skull crusher',
  'ez bar skull crusher': 'barbell lying triceps extension skull crusher',
  'french press': 'ez bar standing french press',
  'face pull': 'cable rear delt row with rope',
  'face pulls': 'cable rear delt row with rope',
  'bulgarian split squat': 'split squats',
  'bulgarian split squats': 'split squats',
  'hip thrust': 'barbell hip thrust',
  'hip thrusts': 'barbell hip thrust',
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
  'seated cable row': '0861',
  'seated cable rows': '0861',
  'cable seated row': '0861',
  'cable row': '0861',
  'cable rows': '0861',
  'skull crusher': '0060',
  'skull crushers': '0060',
  skullcrusher: '0060',
  skullcrushers: '0060',
  'face pull': '0203',
  'face pulls': '0203',
  'bulgarian split squat': '2368',
  'bulgarian split squats': '2368',
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

function compactedKey(value: string): string {
  return normalizeKey(value).replace(/\s+/g, '')
}

/** Singular/plural + compound tolerance (crushers ↔ crusher, skull crusher ↔ skullcrusher). */
function textHasToken(haystack: string, token: string): boolean {
  if (!token) return true
  if (haystack.includes(token)) return true
  if (token.length > 3 && token.endsWith('s') && haystack.includes(token.slice(0, -1))) {
    return true
  }
  if (token.length > 2 && !token.endsWith('s') && haystack.includes(`${token}s`)) {
    return true
  }
  const compactHay = haystack.replace(/\s+/g, '')
  if (compactHay.includes(token) || compactHay.includes(token.replace(/s$/, ''))) {
    return true
  }
  return false
}

/** Pick the best catalog row when search returns multiple hits (AI often uses shorthand names). */
export function pickBestCatalogMatch(
  query: string,
  hits: Array<{ id: string; name: string; equipment: string }>,
  options?: { homeOnly?: boolean; allowWeak?: boolean },
): { id: string; name: string } | null {
  if (hits.length === 0) return null
  const key = normalizeKey(query)
  if (!key) return hits[0] ?? null

  const exact = hits.find((hit) => normalizeKey(hit.name) === key)
  if (exact) return exact

  const compactQuery = compactedKey(query)
  const queryTokens = key.split(' ').filter((token) => token.length > 1)
  const homeOnly = options?.homeOnly ?? false
  let best: { hit: (typeof hits)[0]; score: number } | null = null

  for (const hit of hits) {
    const nameKey = normalizeKey(hit.name)
    const compactName = compactedKey(hit.name)
    let score = 0

    if (nameKey === key || compactName === compactQuery) score += 100
    if (nameKey.startsWith(key)) score += 40
    if (nameKey.includes(key) || compactName.includes(compactQuery)) score += 25
    if (
      queryTokens.length > 0 &&
      queryTokens.every((token) => textHasToken(nameKey, token))
    ) {
      score += 60
      const nameTokens = nameKey.split(' ').filter((token) => token.length > 1)
      score -= Math.max(0, nameTokens.length - queryTokens.length) * 8
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

  if (!best) return null
  // Coach nicknames rarely match catalog wording exactly — accept a weaker
  // best hit when the search already narrowed candidates.
  const minScore = options?.allowWeak ? 8 : 30
  if (best.score < minScore) {
    return options?.allowWeak ? best.hit : null
  }
  return best.hit
}

/**
 * Resolve a coach-provided exercise id/name to a catalog source id.
 * Prefers exact matches, then aliases, then fuzzy catalog search.
 */
export function resolveExerciseRef(
  rawId: string,
  rawName: string,
  options?: { homeOnly?: boolean },
): { id: string | null; matchedAs?: string } {
  const idRaw = rawId.trim()
  const nameRaw = rawName.trim()
  const homeOnly = options?.homeOnly ?? false

  const resolved = resolveCatalogId(idRaw || nameRaw)
  if (resolved.id) return { id: resolved.id }

  if (nameRaw) {
    const idAlias = resolveExerciseIdAlias(nameRaw)
    if (idAlias && getExerciseById(idAlias)) {
      return { id: idAlias, matchedAs: 'alias' }
    }
  }

  const queries = nameRaw
    ? Array.from(
        new Set(
          [
            aliasSearchQuery(nameRaw),
            nameRaw,
            normalizeKey(nameRaw),
            compactedKey(nameRaw),
          ].filter((q) => q.trim().length > 0),
        ),
      )
    : []

  for (const query of queries) {
    const hits = searchCatalogExercises({ query, limit: 16, homeOnly })
    if (hits.length === 0) continue
    if (hits.length === 1) return { id: hits[0].id, matchedAs: query }
    const key = normalizeKey(nameRaw || query)
    const exact = hits.find((hit) => normalizeKey(hit.name) === key)
    if (exact) return { id: exact.id, matchedAs: query }
    const picked =
      pickBestCatalogMatch(nameRaw || query, hits, { homeOnly }) ??
      pickBestCatalogMatch(nameRaw || query, hits, { homeOnly, allowWeak: true })
    if (picked) return { id: picked.id, matchedAs: query }
  }

  // Drop leading adjectives/branding the model adds ("Bulgarian Split Squat" → "split squat").
  const tokens = normalizeKey(nameRaw).split(' ').filter((token) => token.length > 2)
  for (let start = 1; start < tokens.length; start += 1) {
    const sub = tokens.slice(start).join(' ')
    const hits = searchCatalogExercises({ query: sub, limit: 16, homeOnly })
    if (hits.length === 0) continue
    const picked =
      pickBestCatalogMatch(sub, hits, { homeOnly }) ??
      pickBestCatalogMatch(sub, hits, { homeOnly, allowWeak: true }) ??
      (hits.length === 1 ? hits[0] : null)
    if (picked) return { id: picked.id, matchedAs: sub }
  }

  // Try each significant token alone (longest first): "ez bar skull crushers" → "skull"/"crushers".
  const soloTokens = [...tokens].sort((a, b) => b.length - a.length)
  const GENERIC_SOLO =
    /^(press|raise|curl|row|fly|flies|extension|hold|pull|push|lift|machine|exercise|workout|movement|with|from)$/
  for (const token of soloTokens) {
    if (token.length < 5) continue
    if (GENERIC_SOLO.test(token)) continue
    const hits = searchCatalogExercises({ query: token, limit: 16, homeOnly })
    const picked =
      pickBestCatalogMatch(nameRaw || token, hits, { homeOnly, allowWeak: true }) ??
      pickBestCatalogMatch(token, hits, { homeOnly, allowWeak: true })
    if (picked) return { id: picked.id, matchedAs: token }
  }

  // Last resort: score the whole catalog by token/compact overlap.
  const scanned = fuzzyScanCatalog(nameRaw, { homeOnly, limit: 8 })
  if (scanned.length > 0) {
    const picked =
      pickBestCatalogMatch(nameRaw, scanned, { homeOnly, allowWeak: true }) ?? scanned[0]
    if (picked) return { id: picked.id, matchedAs: 'fuzzy' }
  }

  if (resolved.matches.length === 1) {
    return { id: resolved.matches[0].id }
  }

  return { id: null }
}

/**
 * Brute-force catalog scan when normal search misses (nicknames, compound words).
 */
export function fuzzyScanCatalog(
  query: string,
  options?: { homeOnly?: boolean; limit?: number },
): Array<{ id: string; name: string; equipment: string }> {
  const key = normalizeKey(query)
  const compact = compactedKey(query)
  if (!key && !compact) return []
  const tokens = key.split(' ').filter((token) => token.length > 2)
  const STOP_TOKENS =
    /^(a|an|the|and|or|with|from|for|into|over|under|totally|fake|unknown|random|custom|special|machine|exercise|movement|workout|press|raise|curl|row|lift|hold|pull|push)$/
  const meaningfulTokens = tokens.filter(
    (token) => token.length >= 4 && !STOP_TOKENS.test(token),
  )
  const homeOnly = options?.homeOnly ?? false
  const limit = Math.min(20, Math.max(1, options?.limit ?? 8))
  const scored: Array<{ id: string; name: string; equipment: string; score: number }> = []

  for (const exercise of loadExerciseCatalog()) {
    if (homeOnly && !isHomeEquipment(exercise.equipment)) continue
    const nameKey = normalizeKey(exercise.name)
    const compactName = compactedKey(exercise.name)
    let score = 0
    if (compact && compactName.includes(compact)) score += 50
    if (compact && compact.includes(compactName) && compactName.length > 4) score += 30
    if (meaningfulTokens.length > 0) {
      const matched = meaningfulTokens.filter((token) =>
        textHasToken(nameKey, token),
      ).length
      score += matched * 18
      if (matched === meaningfulTokens.length) score += 25
      const strongCompact =
        compact.length >= 8 &&
        (compactName.includes(compact) || compact.includes(compactName))
      if (matched < Math.min(2, meaningfulTokens.length) && !strongCompact) continue
    } else if (!(compact.length >= 6 && compactName.includes(compact))) {
      // No meaningful tokens (pure gibberish / stopwords) — do not guess.
      continue
    }
    if (score < 36) continue
    scored.push({
      id: exercise.sourceId,
      name: exercise.name,
      equipment: exercise.equipment,
      score,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ id, name, equipment }) => ({ id, name, equipment }))
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
