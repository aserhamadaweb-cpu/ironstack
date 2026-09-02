import { ONBOARDING_PATH } from '@/lib/onboarding-types'
import { getSiteUrl } from '@/lib/site-url'

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
