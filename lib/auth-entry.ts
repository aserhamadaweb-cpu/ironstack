import { safeAuthNextPath } from '@/lib/safe-next-path'

export type AuthEntryOptions = {
  next?: string | null
  mode?: 'signin' | 'signup'
}

/** Destination after the language gate (login with optional query). */
export function buildLoginPath(options?: AuthEntryOptions): string {
  const params = new URLSearchParams()
  if (options?.mode === 'signup') params.set('mode', 'signup')
  const safeNext = safeAuthNextPath(options?.next ?? null)
  if (safeNext) params.set('next', safeNext)
  const qs = params.toString()
  return qs ? `/login?${qs}` : '/login'
}

/** Public auth entry — language picker on /login first, then sign-in form. */
export function buildAuthEntryHref(options?: AuthEntryOptions): string {
  const params = new URLSearchParams()
  params.set('pickLanguage', '1')
  if (options?.mode === 'signup') params.set('mode', 'signup')
  const safeNext = safeAuthNextPath(options?.next ?? null)
  if (safeNext) params.set('next', safeNext)
  return `/login?${params.toString()}`
}

export function isPickLanguageEntry(
  value: string | null | undefined,
): boolean {
  return value === '1' || value === 'true'
}
