'use server'

import { createClient } from '@/lib/supabase/server'

/** Drop an anonymous guest session before starting email/password auth. */
export async function abandonAnonymousSessionIfPresent(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.is_anonymous) return

  // Global sign-out revokes the anonymous refresh token and clears auth cookies.
  await supabase.auth.signOut({ scope: 'global' })
}
