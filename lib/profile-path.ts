/** Public profile URL — prefer username, fall back to user id. Always returns a path when userId is known. */
export function profileHref(
  username: string | null | undefined,
  userId?: string | null,
): string {
  const handle = username?.trim()
  if (handle) return `/profile/${encodeURIComponent(handle)}`
  if (userId?.trim()) return `/profile/${encodeURIComponent(userId.trim())}`
  return '/dashboard/profile'
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isProfileUserIdParam(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Suggest a valid username from an email local-part or display name. */
export function suggestUsernameFromEmail(
  emailOrName: string | null | undefined,
): string {
  const raw = (emailOrName ?? 'athlete').split('@')[0] ?? 'athlete'
  let slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
  if (slug.length < 3) {
    slug = (slug + '_athlete').slice(0, 30)
  }
  if (!/^[a-z]/.test(slug)) {
    slug = `u_${slug}`.slice(0, 30)
  }
  return slug
}

export function orderedDmPair(userId1: string, userId2: string) {
  return userId1 < userId2
    ? { user_a_id: userId1, user_b_id: userId2 }
    : { user_a_id: userId2, user_b_id: userId1 }
}
