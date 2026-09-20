'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getIsGuestAction } from '@/lib/data/profile-actions'
import { createClient } from '@/lib/supabase/client'
import {
  clearSyncClientCaches,
  handleAuthUserChanged,
} from '@/lib/clear-client-user-state'

const GUEST_STORAGE_KEY = 'ironstack:is-guest'

/** Remove leftover guest/onboarding flags and per-account browser caches. */
export function clearIronstackAuthCache() {
  clearSyncClientCaches({ keepDevicePrefs: false })
}

/** @deprecated Use clearIronstackAuthCache */
export function clearGuestCache() {
  clearIronstackAuthCache()
}

function guestFromUser(user: User | null | undefined): boolean {
  return user?.is_anonymous === true
}

function readCachedGuest(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(GUEST_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCachedGuest(guest: boolean) {
  try {
    if (guest) sessionStorage.setItem(GUEST_STORAGE_KEY, '1')
    else sessionStorage.removeItem(GUEST_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Shared guest flag for nav, floating actions, and social UI. */
export function useIsGuest() {
  const supabase = useMemo(() => createClient(), [])
  const [isGuest, setIsGuest] = useState(readCachedGuest)
  const [ready, setReady] = useState(() => readCachedGuest())

  useEffect(() => {
    let cancelled = false

    const applyGuest = (guest: boolean) => {
      if (cancelled) return
      setIsGuest(guest)
      setReady(true)
      writeCachedGuest(guest)
    }

    const refresh = (user: User | null) => {
      if (!user) {
        // Offline / failed Auth probe must NOT wipe IndexedDB. Only an explicit
        // SIGNED_OUT event (below) clears offline splits + sessions.
        applyGuest(readCachedGuest())
        return
      }
      void handleAuthUserChanged(user.id)
      if (guestFromUser(user)) {
        applyGuest(true)
        return
      }
      void getIsGuestAction()
        .then((guest) => applyGuest(guest))
        .catch(() => applyGuest(readCachedGuest()))
    }

    void (async () => {
      try {
        // Prefer local session (works offline). getUser() hits the network and
        // often returns null when offline — that used to wipe offline data.
        const { data: sessionData } = await supabase.auth.getSession()
        if (cancelled) return
        if (sessionData.session?.user) {
          refresh(sessionData.session.user)
          return
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          applyGuest(readCachedGuest())
          return
        }
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled) return
        refresh(user ?? null)
      } catch {
        if (!cancelled) applyGuest(readCachedGuest())
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        void handleAuthUserChanged(null, { isSignOut: true })
        clearIronstackAuthCache()
        applyGuest(false)
        return
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'INITIAL_SESSION'
      ) {
        refresh(session?.user ?? null)
        return
      }
      refresh(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  return { isGuest, ready }
}
