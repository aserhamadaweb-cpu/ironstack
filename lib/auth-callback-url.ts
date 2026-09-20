import { ONBOARDING_PATH } from '@/lib/onboarding-types'
import { getSiteUrl } from '@/lib/site-url'

/** Hardcoded public Web Client ID — Google client IDs are not secrets. */
export const GOOGLE_WEB_CLIENT_ID_FALLBACK =
  '56468983247-a82pf1m3ts6054vpjso0s36b30plo8mu.apps.googleusercontent.com'

/**
 * Accept only a real Google Web Client ID.
 * Vercel "Sensitive" NEXT_PUBLIC_* vars can be inlined as junk placeholders
 * like "y" at build time — never treat those as a client id.
 */
export function isValidGoogleWebClientId(value: string | null | undefined): value is string {
  const id = value?.trim()
  if (!id) return false
  if (!id.includes('.apps.googleusercontent.com')) return false
  // Reject Vercel Sensitive placeholders / garbage
  if (id.length < 40 || /sensitive/i.test(id) || id === 'y') return false
  return true
}

/** Public Google Web Client ID — safe in the browser bundle. */
export const GOOGLE_WEB_CLIENT_ID = isValidGoogleWebClientId(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
)
  ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!.trim()
  : GOOGLE_WEB_CLIENT_ID_FALLBACK

export function siteOriginFromEnv(): string {
  return getSiteUrl()
}

/** Builds /auth/callback?next=… for Supabase emailRedirectTo (server-safe). */
export function buildAuthCallbackUrl(
  nextPath?: string | null,
  origin = siteOriginFromEnv(),
): string {
  const next =
    nextPath?.trim() && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath.trim()
      : ONBOARDING_PATH
  const url = new URL('/auth/callback', origin)
  url.searchParams.set('next', next)
  return url.href
}

/**
 * Client OAuth entry (Google, etc.). Must be a page — not a route handler — so
 * hash tokens (#access_token=…) survive. Forwards ?code= to the server callback.
 */
export function buildOAuthReturnUrl(
  nextPath?: string | null,
  origin = siteOriginFromEnv(),
): string {
  const next =
    nextPath?.trim() && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath.trim()
      : ONBOARDING_PATH
  const url = new URL('/auth/oauth-return', origin)
  url.searchParams.set('next', next)
  return url.href
}
