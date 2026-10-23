import type { LibraryExercise } from '@/lib/exercise-library'
import type { MuscleGroup, SplitDetail } from '@/lib/split-data'
import { exerciseToLibraryExercise } from '@/lib/exercises/adapters'
import {
  loadExerciseCatalog,
  loadIdentityMapFile,
} from '@/lib/exercises/catalog'
import { SPLIT_LIBRARY_ALIASES, resolveSplitAliasId } from '@/lib/exercises/identity'
import { normalizeKey } from '@/lib/exercises/normalizers'
import { isNoEquipment } from '@/lib/exercises/home-workouts'
import { gifUrlFromImageUrl } from '@/lib/exercises/paths'

/** Reads the Gym visual 1,324-exercise catalog (server-side only). */
export function loadExerciseLibrary(): LibraryExercise[] {
  return loadExerciseCatalog().map(exerciseToLibraryExercise)
}

let libraryById: Map<string, LibraryExercise> | null = null
let libraryByNormalizedName: Map<string, LibraryExercise> | null = null
let libraryByLegacySlug: Map<string, LibraryExercise> | null = null
let libraryByOldCatalogId: Map<string, LibraryExercise> | null = null

function libraryIndexes() {
  if (
    libraryById &&
    libraryByNormalizedName &&
    libraryByLegacySlug &&
    libraryByOldCatalogId
  ) {
    return {
      byId: libraryById,
      byName: libraryByNormalizedName,
      bySlug: libraryByLegacySlug,
      byOldId: libraryByOldCatalogId,
    }
  }

  const byId = new Map<string, LibraryExercise>()
  const byName = new Map<string, LibraryExercise>()
  const bySlug = new Map<string, LibraryExercise>()
  const byOldId = new Map<string, LibraryExercise>()
  const identity = loadIdentityMapFile()

  for (const entry of loadExerciseLibrary()) {
    byId.set(entry.id, entry)
    const key = normalizeKey(entry.name)
    if (!byName.has(key)) byName.set(key, entry)
    if (entry.legacySlug) bySlug.set(entry.legacySlug, entry)
    const match = identity.bySourceId[entry.id]
    if (match) byOldId.set(match.oldCatalogId, entry)
  }

  libraryById = byId
  libraryByNormalizedName = byName
  libraryByLegacySlug = bySlug
  libraryByOldCatalogId = byOldId
  return { byId, byName, bySlug, byOldId }
}

/**
 * Resolve an exercise name (from seeded splits / lift_types) to the current
 * catalog entry the custom split builder uses.
 */
export function resolveLibraryExercise(
  name: string,
  liftTypeId?: string | null,
): LibraryExercise | null {
  const { byId, byName, bySlug, byOldId } = libraryIndexes()

  const identity = liftTypeId?.trim()
  if (identity) {
    const fromId = byId.get(identity)
    if (fromId) return fromId
    const fromSlug = bySlug.get(identity)
    if (fromSlug) return fromSlug
    const fromOld = byOldId.get(identity)
    if (fromOld) return fromOld
  }

  const trimmed = name.trim()
  if (!trimmed) return null

  const direct = byId.get(trimmed)
  if (direct) return direct

  const byLegacy = bySlug.get(trimmed)
  if (byLegacy) return byLegacy

  const aliasId = resolveSplitAliasId(trimmed) ?? SPLIT_LIBRARY_ALIASES[trimmed]
  if (aliasId) {
    const fromOld = byOldId.get(aliasId)
    if (fromOld) return fromOld
    const aliased = byId.get(aliasId)
    if (aliased) return aliased
  }

  const exact = byName.get(normalizeKey(trimmed))
  if (exact) return exact

  const needle = normalizeKey(trimmed)
  let best: LibraryExercise | null = null
  for (const [key, entry] of byName) {
    if (!key.includes(needle) && !needle.includes(key)) continue
    if (!best || entry.name.length < best.name.length) best = entry
  }
  return best
}

/** Resolves a ready-made split exercise name to a real thumbnail URL, if known. */
export function resolveExerciseImage(name: string): string | null {
  return resolveLibraryExercise(name)?.image ?? null
}

/**
 * Enrich a split (recommended or custom) with photos + muscle labels from
 * the current exercise catalog — the same catalog as Create Your Own Split.
 */
export function enrichSplitFromLibrary(split: SplitDetail): SplitDetail {
  const muscleMap: Record<string, MuscleGroup> = {
    Chest: 'Chest',
    Back: 'Back',
    Shoulders: 'Shoulders',
    Biceps: 'Biceps',
    Triceps: 'Triceps',
    Quads: 'Quads',
    Hamstrings: 'Hamstrings',
    Glutes: 'Glutes',
    Calves: 'Calves',
    Abs: 'Core',
    Core: 'Core',
    Traps: 'Traps',
    Cardio: 'Core',
    Neck: 'Traps',
  }

  return {
    ...split,
    schedule: split.schedule.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => {
        const library = resolveLibraryExercise(exercise.name, exercise.liftTypeId)
        const rawMuscle = library?.muscles[0]
        const muscle = rawMuscle
          ? (muscleMap[rawMuscle] ?? exercise.muscle)
          : exercise.muscle
        return {
          ...exercise,
          name: library?.name ?? exercise.name,
          category:
            library?.category === 'cardio' || library?.bodyPart === 'cardio'
              ? 'cardio'
              : (exercise.category ?? library?.category ?? undefined),
          image: library?.image ?? exercise.image ?? undefined,
          gif:
            library?.gifUrl ??
            gifUrlFromImageUrl(library?.image ?? exercise.image) ??
            undefined,
          muscle,
          bodyweight: isNoEquipment(library?.equipment),
          liftTypeId: exercise.liftTypeId ?? library?.id,
          catalogExerciseId: library?.id,
        }
      }),
    })),
  }
}

/** @deprecated Prefer enrichSplitFromLibrary — kept for older call sites. */
export function withResolvedImages(split: SplitDetail): SplitDetail {
  return enrichSplitFromLibrary(split)
}
