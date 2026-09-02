/**
 * Read the last known user from the Supabase session cookie / localStorage
 * without contacting Auth. Expired access tokens still include `user.id`;
 * use that only for local-first outbox writes and offline dashboard shell.
 * Live API calls still need a real JWT (refreshed once online) + RLS.
 */

export type StoredAuthIdentity = {
  userId: string
  email: string | null
}

function subFromJwt(token: string): string | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8')
    const payload = JSON.parse(json) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

function decodeMaybeUri(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function parseSessionJson(raw: string): Record<string, unknown> | null {
  const text = decodeMaybeUri(raw.trim())
  const candidates = [text]
  if (text.startsWith('base64-')) {
    try {
      const decoded =
        typeof atob === 'function'
          ? atob(text.slice(7))
          : Buffer.from(text.slice(7), 'base64').toString('utf8')
      candidates.unshift(decoded)
    } catch {
      /* ignore */
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* try next */
    }
  }
  return null
}

function identityFromSessionObject(
  parsed: Record<string, unknown> | null,
): StoredAuthIdentity | null {
  if (!parsed) return null
  const nested = parsed.currentSession
  const session =
    nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>)
      : parsed
  const user = session.user
  const userObj = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  const email = typeof userObj?.email === 'string' ? userObj.email : null
  if (typeof userObj?.id === 'string' && userObj.id) {
    return { userId: userObj.id, email }
  }
  const token = session.access_token
  if (typeof token === 'string') {
    const sub = subFromJwt(token)
    if (sub) return { userId: sub, email }
  }
  return null
}

export function identityFromStoredSessionRaw(raw: string): StoredAuthIdentity | null {
  return identityFromSessionObject(parseSessionJson(raw))
}

export function identityFromCookieList(
  cookies: Array<{ name: string; value: string }>,
): StoredAuthIdentity | null {
  const chunks = new Map<string, string[]>()
  for (const { name, value } of cookies) {
    if (!name.includes('-auth-token')) continue
    const base = name.replace(/\.\d+$/, '')
    const match = name.match(/\.(\d+)$/)
    const index = match ? Number(match[1]) : 0
    const parts = chunks.get(base) ?? []
    parts[index] = value
    chunks.set(base, parts)
  }

  for (const parts of chunks.values()) {
    const raw = parts.filter((part) => typeof part === 'string').join('')
    const identity = identityFromStoredSessionRaw(raw)
    if (identity) return identity
  }
  return null
}

export function identityFromBrowserStorage(): StoredAuthIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith('sb-') || !key.includes('auth-token')) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const identity = identityFromStoredSessionRaw(raw)
      if (identity) return identity
    }
  } catch {
    /* private mode / blocked storage */
  }
  return null
}
