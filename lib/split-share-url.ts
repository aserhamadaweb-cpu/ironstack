/** Builds the canonical public URL for a split share token. */
export function splitSharePath(token: string): string {
  return `/share/split/${encodeURIComponent(token)}`
}

export function splitShareAbsoluteUrl(token: string, origin?: string): string {
  const base =
    origin?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  return `${base}${splitSharePath(token)}`
}
