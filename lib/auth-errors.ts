/** Map Auth/API errors to friendly copy. Never surface secrets or raw stacks. */

export type AuthCopy = {
  invalidEmail: string
  weakPassword: string
  passwordMismatch: string
  invalidCredentials: string
  alreadyRegistered: string
  confirmEmail: string
  oauthCancelled: string
  socialFailed: string
  network: string
  rateLimited: string
  generic: string
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function friendlyAuthError(
  message: string,
  copy: AuthCopy,
  code?: string,
): string {
  const lower = message.toLowerCase()
  if (
    code === 'email_not_confirmed' ||
    lower.includes('email not confirmed')
  ) {
    return copy.generic
  }
  if (
    code === 'invalid_credentials' ||
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials')
  ) {
    return copy.invalidCredentials
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already registered') ||
    lower.includes('email already')
  ) {
    return copy.alreadyRegistered
  }
  if (
    lower.includes('password') &&
    (lower.includes('at least') ||
      lower.includes('too short') ||
      lower.includes('weak'))
  ) {
    return copy.weakPassword
  }
  if (
    lower.includes('invalid email') ||
    lower.includes('unable to validate email') ||
    code === 'email_address_invalid'
  ) {
    return copy.invalidEmail
  }
  if (
    lower.includes('access_denied') ||
    (lower.includes('oauth') && lower.includes('cancel'))
  ) {
    return copy.oauthCancelled
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('fetch failed')
  ) {
    return copy.network
  }
  if (
    code === 'over_request_rate_limit' ||
    lower.includes('rate') ||
    lower.includes('too many')
  ) {
    return copy.rateLimited
  }
  return copy.generic
}
