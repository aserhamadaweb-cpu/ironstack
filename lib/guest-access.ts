import { buildAuthEntryHref } from '@/lib/auth-entry'

export type GuestBlockedReason =
  | 'startSession'
  | 'createSplit'
  | 'editSplit'
  | 'aiCoach'
  | 'sessionCoach'
  | 'shareSplit'
  | 'saveSplit'
  | 'messages'
  | 'challenges'
  | 'editProfile'
  | 'social'
  | 'generic'

/** Sign-up entry for guests upgrading from a blocked action. */
export function buildGuestSignupHref(next?: string | null) {
  return buildAuthEntryHref({
    mode: 'signup',
    next: next ?? undefined,
  })
}
