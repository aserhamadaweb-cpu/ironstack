export type ServerSession = {
  userId: string | null
  isAnonymous: boolean
  email: string | null
}

/**
 * Cookie session as seen by the server.
 * - Returns a session object (possibly `userId: null`) when whoami answered.
 * - Returns `null` only when the request failed (offline / network / non-OK) —
 *   callers must treat that as **unknown**, never as “logged out.”
 */
export async function readServerSessionClient(): Promise<ServerSession | null> {
  try {
    const res = await fetch('/api/auth/whoami', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as ServerSession
  } catch {
    return null
  }
}
