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
  staleClient?: string
  rateLimited: string
  generic: string
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isStaleServerActionError(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes('failed to find server action') ||
    lower.includes('server action') ||
    lower.includes('was not found on the server') ||
    // Next often surfaces stale-action POSTs as a bare fetch failure.
    lower.includes('unexpected response was received from the server')
  )
}

/** True when a rebuild left the tab on outdated Server Action IDs (or bare fetch fail). */
export function isStaleClientAuthError(message: string) {
  const lower = message.toLowerCase()
  return (
    isStaleServerActionError(message) ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('load failed') ||
    lower.includes('network')
  )
}

export function friendlyAuthError(
  message: string,
  copy: AuthCopy,
  code?: string,
): string {
  const lower = message.toLowerCase()
  if (isStaleServerActionError(message)) {
    return copy.staleClient || copy.generic
  }
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
    lower.includes('nonce') ||
    lower.includes('unacceptable audience') ||
    lower.includes('invalid id token') ||
    lower.includes('id token') ||
    lower.includes('provider is not enabled') ||
    lower.includes('unsupported provider') ||
    lower.includes('could not establish a signed-in session') ||
    lower.includes('google identity') ||
    lower.includes('unregistered_origin') ||
    lower.includes('authorized javascript origins') ||
    lower.includes('could not load google')
  ) {
    return copy.socialFailed
  }
  if (
    lower.includes('database error saving new user') ||
    lower.includes('profiles_non_guest_requires_username')
  ) {
    return copy.socialFailed
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('load failed')
  ) {
    // After a local rebuild, stale JS often fails Server Actions as "Failed to fetch".
    // Prefer a refresh hint over a misleading offline message.
    return copy.staleClient || copy.network
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
