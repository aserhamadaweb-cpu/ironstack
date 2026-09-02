import { getSiteUrl } from '@/lib/site-url'

/** Builds the canonical public URL for a split share token. */
export function splitSharePath(token: string): string {
  return `/share/split/${encodeURIComponent(token)}`
}

export function splitShareAbsoluteUrl(token: string, origin?: string): string {
  const base =
    origin?.replace(/\/$/, '') ||
    getSiteUrl(
      typeof window !== 'undefined' ? window.location.origin : null,
    )
  return `${base}${splitSharePath(token)}`
}
