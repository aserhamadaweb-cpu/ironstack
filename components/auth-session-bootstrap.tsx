'use client'

import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { readServerSessionClient } from '@/lib/auth/read-server-session'
import { handleAuthUserChanged } from '@/lib/clear-client-user-state'
import { setCachedUserId } from '@/lib/offline/cache'
import {
  purgeLegacySupabaseLocalStorage,
  purgeSupabaseBrowserAuthStorage,
} from '@/lib/supabase/purge-browser-auth'

const GUEST_FLAG_KEY = 'ironstack:is-guest'
const REFRESH_WINDOW_SECONDS = 5 * 60

function clearGuestClientFlag() {
  try {
    sessionStorage.removeItem(GUEST_FLAG_KEY)
  } catch {
    /* ignore */
  }
}

/** Hydrate the browser client from cookies — getUser() alone can be null on cold start. */
async function hydrateClientUser(
  supabase: ReturnType<typeof createClient>,
): Promise<User | null> {
  let {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return user

  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.user) return sessionData.session.user

  await supabase.auth.refreshSession()
  ;({
    data: { user },
  } = await supabase.auth.getUser())
  if (user) return user

  const { data: retrySession } = await supabase.auth.getSession()
  return retrySession.session?.user ?? null
}

/**
 * Aligns the browser Supabase client with the cookie session the server sees.
 * Never deletes HTTP cookies when the server still has a valid session — that
 * was causing signed-in users to land on /login after PWA cold start.
 */
export function AuthSessionBootstrap() {
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      try {
        purgeLegacySupabaseLocalStorage()

        const server = await readServerSessionClient()
        if (cancelled) return

        let user = await hydrateClientUser(supabase)
        if (cancelled) return

        // whoami unreachable (offline / 5xx): unknown — never local-signOut.
        // Signing out here used to fire SIGNED_OUT → wipe IndexedDB pins/sessions.
        if (server === null) {
          if (user) {
            await handleAuthUserChanged(user.id)
            await setCachedUserId(user.id)
            if (!user.is_anonymous) clearGuestClientFlag()
          }
          return
        }

        if (server.userId) {
          // Confirmed account switch: two different signed-in user ids.
          if (user?.id && user.id !== server.userId) {
            await supabase.auth.signOut({ scope: 'local' })
            // Await wipe before reload so IndexedDB isn't left half-cleared.
            await handleAuthUserChanged(server.userId)
            await setCachedUserId(server.userId)
            purgeSupabaseBrowserAuthStorage()
            window.location.reload()
            return
          }

          if (user?.is_anonymous && !server.isAnonymous) {
            await supabase.auth.refreshSession()
            if (cancelled) return
            user = (await hydrateClientUser(supabase)) ?? user
          }

          // Server cookies are valid; client SDK may still be catching up.
          if (!user) {
            await handleAuthUserChanged(server.userId)
            await setCachedUserId(server.userId)
            if (!server.isAnonymous) clearGuestClientFlag()
            return
          }
        } else if (user) {
          // Authoritative: whoami answered with no user — cookies are gone.
          await supabase.auth.signOut({ scope: 'local' })
          purgeLegacySupabaseLocalStorage()
          return
        } else {
          return
        }

        if (!user) return

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
          user = (await hydrateClientUser(supabase)) ?? user
          if (!user) return
        }

        await handleAuthUserChanged(user.id)
        await setCachedUserId(user.id)
      } catch {
        /* offline or expired */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
