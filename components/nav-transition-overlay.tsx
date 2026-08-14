'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, useReducedMotion } from 'framer-motion'
import { HubPreloader } from '@/components/hub-preloader'
import { markHubIntroSeen } from '@/components/route-preloader'
import {
  armNavTransition,
  consumeArmedNavTransition,
  isNavTransitionActive,
  isNavTransitionArmed,
  startNavTransition,
  subscribeNavTransition,
} from '@/lib/nav-transition'

/**
 * Plays the IronStack slam AFTER the destination route has painted —
 * not before navigation starts.
 */
export function NavTransitionOverlay() {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const [active, setActive] = useState(false)

  useEffect(() => subscribeNavTransition(setActive), [])

  useEffect(() => {
    setActive(isNavTransitionActive())
  }, [])

  useEffect(() => {
    if (reduce) {
      consumeArmedNavTransition()
      return
    }
    // Peek only — consume right before play so Strict Mode remounts don't drop it.
    if (!isNavTransitionArmed()) return

    let cancelled = false
    let innerRaf = 0
    // Double rAF ≈ after layout + paint of the new route.
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (cancelled) return
        if (!consumeArmedNavTransition()) return
        markHubIntroSeen()
        startNavTransition()
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      if (innerRaf) cancelAnimationFrame(innerRaf)
    }
  }, [pathname, reduce])

  if (reduce) return null

  return (
    <AnimatePresence>{active ? <HubPreloader /> : null}</AnimatePresence>
  )
}

/** Arm transition for the upcoming navigation (plays after paint). */
export function triggerIronStackNavTransition() {
  armNavTransition()
}
