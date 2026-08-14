'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'framer-motion'
import { HubPreloader } from '@/components/hub-preloader'

const INTRO_MS = 900
const INTRO_SEEN_KEY = 'ironstack:hub-intro-seen'

/** True if this tab already showed the dumbbell intro. */
export function hasSeenHubIntro(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markHubIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Full-screen intro once per browser tab session — not on every navigation.
 * After the first show, renders nothing so pages paint immediately.
 */
export function RoutePreloader() {
  const reduce = useReducedMotion()
  const [done, setDone] = useState(true)

  useEffect(() => {
    if (reduce || hasSeenHubIntro()) {
      setDone(true)
      return
    }
    setDone(false)
    const timer = setTimeout(() => {
      markHubIntroSeen()
      setDone(true)
    }, INTRO_MS)
    return () => clearTimeout(timer)
  }, [reduce])

  return <AnimatePresence>{!done && <HubPreloader />}</AnimatePresence>
}
