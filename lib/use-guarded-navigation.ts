'use client'

import { useCallback, useRef, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import { markNavigationIntent } from '@/lib/navigation-intent'

/**
 * Prevents duplicate navigations from rapid taps and records navigation intent
 * so reconnect/sync logic does not fight the user's chosen route.
 */
export function useGuardedNavigation() {
  const pathname = usePathname()
  const pendingHrefRef = useRef<string | null>(null)

  const guardNavigation = useCallback(
    (href: string) => {
      const target = href.split('#')[0] ?? href
      if (!target || target === pathname || pendingHrefRef.current === target) {
        return false
      }
      pendingHrefRef.current = target
      markNavigationIntent(target)
      window.setTimeout(() => {
        if (pendingHrefRef.current === target) pendingHrefRef.current = null
      }, 2_000)
      return true
    },
    [pathname],
  )

  const onNavClick = useCallback(
    (href: string, e: MouseEvent<HTMLAnchorElement>) => {
      if (!guardNavigation(href)) {
        e.preventDefault()
      }
    },
    [guardNavigation],
  )

  return { guardNavigation, onNavClick, pathname }
}
