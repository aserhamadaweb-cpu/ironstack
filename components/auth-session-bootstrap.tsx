'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { handleAuthUserChanged } from '@/lib/clear-client-user-state'
import { setCachedUserId } from '@/lib/offline/cache'

/** Refresh only when the access token is about to expire. */
const REFRESH_WINDOW_SECONDS = 5 * 60

/**
 * Keeps browser-side auth state aligned with the cookie session established by
 * the sign-in server action: caches the user id for offline reads and wipes
 * another account's local data when the signed-in user changes on this device.
 */
export function AuthSessionBootstrap() {
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      try {
        // getSession() reads local state — no network call on a warm start.
        const { data } = await supabase.auth.getSession()
        let session = data.session
        if (cancelled) return

        const expiresAt = session?.expires_at ?? 0
        const secondsLeft = expiresAt - Math.floor(Date.now() / 1000)
        if (session && secondsLeft < REFRESH_WINDOW_SECONDS) {
          const { data: refreshed } = await supabase.auth.refreshSession()
          if (cancelled) return
          session = refreshed.session ?? session
        }

        const userId = session?.user?.id
        if (!userId) return

        await handleAuthUserChanged(userId)
        await setCachedUserId(userId)
      } catch {
        /* offline or expired — middleware and the offline cache handle it */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
