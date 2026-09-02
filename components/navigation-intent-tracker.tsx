'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { markNavigationIntent } from '@/lib/navigation-intent'

/**
 * Records navigation intent for any in-app link tap in the dashboard shell so
 * reconnect/sync refresh logic does not revert the user's chosen route.
 */
export function NavigationIntentTracker() {
  const pathname = usePathname()

  useEffect(() => {
    markNavigationIntent(pathname)
  }, [pathname])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      markNavigationIntent(href.split('#')[0] ?? href)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
