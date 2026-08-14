'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getIsGuestAction } from '@/lib/data/profile-actions'
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
        applyGuest(false)
        return
      }
      if (guestFromUser(user)) {
        applyGuest(true)
        return
      }
      void getIsGuestAction().then((guest) => applyGuest(guest))
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      refresh(user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearIronstackAuthCache()
        applyGuest(false)
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
