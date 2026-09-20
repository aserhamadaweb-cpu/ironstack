import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { identityFromCookieList } from '@/lib/supabase/stored-user-id'
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options'

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
      cookieOptions: supabaseCookieOptions,
    },
  )
})

/**
 * Request-scoped auth identity via JWT claims (no Auth round-trip when JWKS-local).
 * Prefer this in Server Components; use getUser() in mutations that need freshness.
 *
 * If claims/session refresh cannot reach Auth (offline, expired access token),
 * fall back to the user id already stored in cookies so local-first gym flows
 * are not bounced to /login. Network writes still use a live JWT + RLS.
 */
export const getAuthIdentity = cache(async (): Promise<{
  userId: string | null
  email: string | null
}> => {
  const supabase = await createClient()
  try {
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims
    const email = claims?.email
    if (typeof claims?.sub === 'string' && claims.sub) {
      return {
        userId: claims.sub,
        email: typeof email === 'string' ? email : null,
      }
    }
  } catch {
    /* JWKS / network unavailable */
  }

  const cookieStore = await cookies()
  const cached = identityFromCookieList(cookieStore.getAll())
  return cached ?? { userId: null, email: null }
})

export const getAuthUserId = cache(async (): Promise<string | null> => {
  const { userId } = await getAuthIdentity()
  return userId
})
