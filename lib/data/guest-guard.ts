'use server'

import { getIsGuestAction } from '@/lib/data/profile-actions'

const GUEST_BLOCKED_MESSAGE =
  'Create an account to use this feature. Guests can browse only.'

/** Returns an error message when the caller is a guest, otherwise null. */
export async function rejectIfGuest(): Promise<string | null> {
  if (await getIsGuestAction()) return GUEST_BLOCKED_MESSAGE
  return null
}

/** Shorthand for `{ ok: false, error }` action results. */
export async function rejectIfGuestOk(): Promise<
  { ok: false; error: string } | null
> {
  const error = await rejectIfGuest()
  return error ? { ok: false, error } : null
}
