const FREE_EXERCISE_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

/**
 * Normalize lift/exercise image URLs from the DB or library.
 * Rejects bare filenames like "0.jpg" (common bad seed) that resolve to
 * localhost and 404 in a loop of tiny requests.
 */
export function resolveLiftImageUrl(
  image: string | null | undefined,
): string | null {
  const raw = image?.trim()
  if (!raw) return null

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    return raw
  }

  // Relative free-exercise-db path: "Barbell_Curl/0.jpg"
  if (raw.includes('/') && !raw.startsWith('/')) {
    return `${FREE_EXERCISE_IMAGE_BASE}${raw.replace(/^\.?\//, '')}`
  }

  // Bare "0.jpg" / "/0.jpg" — not a usable asset
  return null
}
