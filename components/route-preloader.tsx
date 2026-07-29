'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'framer-motion'
import { HubPreloader } from '@/components/hub-preloader'

const INTRO_MS = 2100

/**
 * Self-contained loading overlay. Shows the IronStack dumbbell intro on mount
 * (i.e. every time you navigate to the page), then fades out. Sits on top of
 * page content via the preloader's fixed z-[100] layer, so it needs no wrapping.
 */
export function RoutePreloader() {
  const reduce = useReducedMotion()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (reduce) {
      setDone(true)
      return
    }
    const timer = setTimeout(() => setDone(true), INTRO_MS)
    return () => clearTimeout(timer)
  }, [reduce])

  return <AnimatePresence>{!done && <HubPreloader />}</AnimatePresence>
}
