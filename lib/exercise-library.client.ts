import {
  liftTypeToLibraryExercise,
  parseExerciseDataset,
  type LibraryExercise,
} from '@/lib/exercise-library'
import {
  cacheExerciseLibrary,
  getCachedExerciseLibrary,
  getCachedLiftTypes,
} from '@/lib/offline/cache'

export const OFFLINE_EXERCISE_CATALOG_URL = '/offline/exercises.json'

/** Skip re-fetching the ~0.4MB catalog when IndexedDB already has a full library. */
const WARM_LIBRARY_MIN = 1_000

let ensureInFlight: Promise<number> | null = null

function pickLargestCatalog(...lists: LibraryExercise[][]): LibraryExercise[] {
  return lists.reduce(
    (best, next) => (next.length > best.length ? next : best),
    [] as LibraryExercise[],
  )
}

export async function loadExerciseLibraryOffline(): Promise<LibraryExercise[]> {
  const [cached, lifts] = await Promise.all([
    getCachedExerciseLibrary().catch(() => []),
    getCachedLiftTypes().catch(() => []),
  ])
  const fromLifts = lifts.map(liftTypeToLibraryExercise)

  let fromFile: LibraryExercise[] = []
  try {
    const response = await fetch(OFFLINE_EXERCISE_CATALOG_URL)
    if (response.ok) {
      fromFile = parseExerciseDataset(await response.json())
    }
  } catch {
    /* SW/IDB fallbacks below */
  }

  const library = pickLargestCatalog(fromFile, cached, fromLifts)
  if (library.length > cached.length) {
    await cacheExerciseLibrary(library).catch(() => undefined)
  }
  return library
}

/**
 * Ensure the exercise library is on-device. Prefer IndexedDB; only hit the
 * network catalog when the local library is missing or thin.
 */
export async function ensureExerciseLibraryCached(): Promise<number> {
  if (ensureInFlight) return ensureInFlight
  ensureInFlight = (async () => {
    try {
      const cached = await getCachedExerciseLibrary().catch(() => [])
      if (cached.length >= WARM_LIBRARY_MIN) return cached.length

      const lifts = await getCachedLiftTypes().catch(() => [])
      if (lifts.length >= WARM_LIBRARY_MIN) {
        const fromLifts = lifts.map(liftTypeToLibraryExercise)
        await cacheExerciseLibrary(fromLifts).catch(() => undefined)
        return fromLifts.length
      }

      const library = await loadExerciseLibraryOffline()
      return library.length
    } catch {
      return 0
    } finally {
      ensureInFlight = null
    }
  })()
  return ensureInFlight
}
