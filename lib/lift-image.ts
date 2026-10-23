/**
 * Normalize lift/exercise image URLs from the DB or library.
 * Only local Gym visual assets (`/exercises/...`) and absolute https URLs
 * that are already complete. The retired free-exercise-db remote is not used.
 */
export function resolveLiftImageUrl(
  image: string | null | undefined,
): string | null {
  const raw = image?.trim()
  if (!raw) return null

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    // Drop retired free-exercise-db remotes so UI falls back to catalog lookup
    if (raw.includes('yuhonas/free-exercise-db')) return null
    return raw
  }

  if (raw.startsWith('/exercises/')) {
    return raw
  }

  if (raw.startsWith('/')) {
    if (/^\/\d+\.(jpg|jpeg|png|gif|webp)$/i.test(raw)) return null
    return raw
  }

  // Relative "images/NNNN-….jpg" from the Gym visual dataset
  if (raw.startsWith('images/')) {
    return `/exercises/${raw}`
  }

  // Bare filename that looks like a Gym visual asset
  if (/^\d{4}-.+\.(jpg|jpeg|png|webp|gif)$/i.test(raw)) {
    return `/exercises/images/${raw}`
  }

  // Bare "0.jpg" / legacy relative paths — not usable without the old remote
  return null
}
