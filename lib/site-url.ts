/**
 * Canonical public site origin for auth redirects and absolute URLs.
 * Prefer NEXT_PUBLIC_SITE_URL in production (Vercel / deployed hosts).
 */
export function getSiteUrl(fallbackOrigin?: string | null): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (fallbackOrigin?.trim()) return fallbackOrigin.trim().replace(/\/$/, '')
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
  return 'http://localhost:3000'
}
