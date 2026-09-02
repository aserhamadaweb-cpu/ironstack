import { ONBOARDING_PATH } from '@/lib/onboarding-types'

export function siteOriginFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
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
