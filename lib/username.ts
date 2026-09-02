/** Shared username rules for signup, onboarding, and profile edits. */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30
export const USERNAME_RE = /^[a-z0-9_]{3,30}$/

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
}

/** Empty string when missing; does not throw. */
export function validateUsernameFormat(username: string): string | null {
  if (!username) return 'Username is required.'
  if (!USERNAME_RE.test(username)) {
    return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters: lowercase letters, numbers, underscores.`
  }
  return null
}

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
export const AVATAR_ACCEPT_LIST = ['image/jpeg', 'image/png', 'image/webp'] as const

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPT_LIST.includes(file.type as (typeof AVATAR_ACCEPT_LIST)[number])) {
    return 'Please choose a JPG, PNG, or WebP image.'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'Image must be 5MB or smaller.'
  }
  return null
}
