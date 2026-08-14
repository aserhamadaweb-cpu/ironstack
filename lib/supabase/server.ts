import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

/** One Supabase client per request — avoids re-reading cookies on every query. */
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — middleware will refresh the session.
          }
        },
      },
    },
  )
})

/**
 * Request-scoped auth identity via JWT claims (no Auth round-trip when JWKS-local).
 * Prefer this in Server Components; use getUser() in mutations that need freshness.
 */
export const getAuthIdentity = cache(async (): Promise<{
  userId: string | null
  email: string | null
}> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const email = claims?.email
  return {
    userId: typeof claims?.sub === 'string' ? claims.sub : null,
    email: typeof email === 'string' ? email : null,
  }
})

export const getAuthUserId = cache(async (): Promise<string | null> => {
  const { userId } = await getAuthIdentity()
  return userId
})
