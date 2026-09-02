export type SplitExerciseDetailRef = {
  id: string
  name: string
}

const CATALOG_NUMERIC = /^\d{1,4}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isCatalogNumericId(id: string): boolean {
  return CATALOG_NUMERIC.test(id.trim())
}

export function isDbUuid(id: string): boolean {
  return UUID_RE.test(id.trim())
}

export function padCatalogId(id: string): string {
  const trimmed = id.trim()
  return CATALOG_NUMERIC.test(trimmed) ? trimmed.padStart(4, '0') : trimmed
}

/** Prefer catalog ids; never use Supabase lift UUIDs as API path segments. */
export function splitExerciseDetailRef(
  exercise: Pick<
    { liftTypeId?: string; catalogExerciseId?: string; name?: string },
    'liftTypeId' | 'catalogExerciseId' | 'name'
  >,
): SplitExerciseDetailRef | null {
  const name = exercise.name?.trim()
  if (!name) return null

  const catalogId = exercise.catalogExerciseId?.trim()
  if (catalogId && isCatalogNumericId(catalogId)) {
    return { id: padCatalogId(catalogId), name }
  }
  if (catalogId && !isDbUuid(catalogId)) {
    return { id: catalogId, name }
  }

  const liftId = exercise.liftTypeId?.trim()
  if (liftId && isCatalogNumericId(liftId)) {
    return { id: padCatalogId(liftId), name }
  }
  if (liftId && !isDbUuid(liftId)) {
    return { id: liftId, name }
  }

  return { id: name, name }
}
