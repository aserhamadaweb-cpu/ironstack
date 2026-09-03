'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { handleAuthUserChanged } from '@/lib/clear-client-user-state'
import { setCachedUserId } from '@/lib/offline/cache'

const GUEST_FLAG_KEY = 'ironstack:is-guest'
const REFRESH_WINDOW_SECONDS = 5 * 60

function clearGuestClientFlag() {
  try {
    sessionStorage.removeItem(GUEST_FLAG_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Aligns browser auth state with the cookie session from server sign-in.
 * Uses getUser() (not getSession()) so a stale anonymous local session
 * cannot reopen as guest after upgrading or signing in from guest mode.
 */
export function AuthSessionBootstrap() {
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled || !user) return

        if (!user.is_anonymous) {
          clearGuestClientFlag()
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData.session
        const expires = session?.expires_at ?? 0
        const secondsLeft = expires - Math.floor(Date.now() / 1000)
        if (session && secondsLeft < REFRESH_WINDOW_SECONDS) {
          await supabase.auth.refreshSession()
          if (cancelled) return
        }

        await handleAuthUserChanged(user.id)
        await setCachedUserId(user.id)
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
