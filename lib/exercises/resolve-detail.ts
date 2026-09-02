import { resolveLibraryExercise } from '@/lib/exercise-library.server'
import {
  aliasSearchQuery,
  pickBestCatalogMatch,
  resolveCatalogId,
  resolveExerciseIdAlias,
  searchCatalogExercises,
} from '@/lib/ai/catalog-lookup'
import { getExerciseById } from '@/lib/exercises/catalog'
import type { Exercise } from '@/lib/exercises/types'

export type ExerciseDetailDto = Omit<Exercise, 'source'>

function catalogIdFromHints(id: string, name?: string): string | null {
  const idTrim = id.trim()
  const nameTrim = name?.trim() ?? ''

  if (idTrim) {
    const aliasId = resolveExerciseIdAlias(idTrim)
    if (aliasId && getExerciseById(aliasId)) return aliasId
    const fromId = resolveCatalogId(idTrim)
    if (fromId.id) return fromId.id
  }

  if (nameTrim) {
    const aliasId = resolveExerciseIdAlias(nameTrim)
    if (aliasId && getExerciseById(aliasId)) return aliasId
    const fromName = resolveCatalogId(nameTrim)
    if (fromName.id) return fromName.id

    const searchQuery = aliasSearchQuery(nameTrim)
    const hits = searchCatalogExercises({ query: searchQuery, limit: 12 })
    if (hits.length === 1) return hits[0].id
    const picked = pickBestCatalogMatch(nameTrim, hits)
    if (picked) return picked.id

    if (searchQuery !== nameTrim) {
      const retryHits = searchCatalogExercises({ query: nameTrim, limit: 12 })
      const retryPick = pickBestCatalogMatch(nameTrim, retryHits)
      if (retryPick) return retryPick.id
    }
  }

  return null
}

/** Resolve catalog id + full exercise row for detail views. */
export function resolveExerciseDetail(
  id: string,
  name?: string,
): ExerciseDetailDto | null {
  const library = resolveLibraryExercise(name?.trim() ?? '', id)
  const catalogId =
    catalogIdFromHints(id, name) ?? library?.id ?? catalogIdFromHints(id)
  if (!catalogId) return null

  const exercise = getExerciseById(catalogId)
  if (!exercise) return null

  const { source, ...rest } = exercise
  void source
  return rest
}
