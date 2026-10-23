'use client'

import { useCallback, useRef, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import { markNavigationIntent } from '@/lib/navigation-intent'

/**
 * Records navigation intent and ignores duplicate taps of the same href.
 * Does not preventDefault on a different in-flight destination — that would
 * cancel Next's transition and look like a jump back to the previous tab.
 */
export function useGuardedNavigation() {
  const pathname = usePathname()
  const pendingHrefRef = useRef<string | null>(null)

  const guardNavigation = useCallback(
    (href: string) => {
      const target = href.split('#')[0] ?? href
      if (!target) return false
      const here = pathname.split('#')[0] ?? pathname
      if (target === here) return false
      if (pendingHrefRef.current === target) return false
      pendingHrefRef.current = target
      markNavigationIntent(target, 'push')
      window.setTimeout(() => {
        if (pendingHrefRef.current === target) pendingHrefRef.current = null
      }, 2_000)
      return true
    },
    [pathname],
  )

  const onNavClick = useCallback(
    (href: string, e: MouseEvent<HTMLAnchorElement>) => {
      const target = href.split('#')[0] ?? href
      const here = pathname.split('#')[0] ?? pathname
      if (target === here || pendingHrefRef.current === target) {
        e.preventDefault()
        return
      }
      guardNavigation(href)
    },
    [guardNavigation, pathname],
  )

  return { guardNavigation, onNavClick, pathname }
}
