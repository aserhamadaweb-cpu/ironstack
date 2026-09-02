import { ONBOARDING_PATH } from '@/lib/onboarding-types'

export function safeAuthNextPath(raw: string | null | undefined) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null
  }
  return raw
}

/** Post-auth redirect target with onboarding fallback. */
export function authRedirectNext(next?: string | null) {
  return safeAuthNextPath(next) ?? ONBOARDING_PATH
}
