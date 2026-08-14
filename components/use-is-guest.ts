'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const GUEST_STORAGE_KEY = 'ironstack:is-guest'
const PROFILE_OK_KEY = 'ironstack:profile-ok'
const USERNAME_OK_KEY = 'ironstack:username-ok'

/** Remove leftover guest/onboarding flags from a prior session. */
export function clearIronstackAuthCache() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(GUEST_STORAGE_KEY)
    sessionStorage.removeItem(PROFILE_OK_KEY)
    sessionStorage.removeItem(USERNAME_OK_KEY)
  } catch {
    /* ignore */
  }
}

/** @deprecated Use clearIronstackAuthCache */
export function clearGuestCache() {
  clearIronstackAuthCache()
}

function guestFromUser(user: User | null | undefined): boolean {
  return user?.is_anonymous === true
}

/** Shared guest flag for nav, floating actions, and social UI. */
export function useIsGuest() {
  const supabase = useMemo(() => createClient(), [])
  const [isGuest, setIsGuest] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const applyUser = (user: User | null) => {
      if (cancelled) return
      const guest = guestFromUser(user)
      setIsGuest(guest)
      setReady(true)
      if (!guest) {
        clearIronstackAuthCache()
      }
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      applyUser(user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearIronstackAuthCache()
        applyUser(null)
        return
      }
      applyUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  return { isGuest, ready }
}
