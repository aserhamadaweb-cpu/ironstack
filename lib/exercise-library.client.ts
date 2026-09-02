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

export async function ensureExerciseLibraryCached(): Promise<number> {
  try {
    const library = await loadExerciseLibraryOffline()
    return library.length
  } catch {
    return 0
  }
}
