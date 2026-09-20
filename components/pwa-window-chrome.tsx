'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isStandaloneDisplay } from '@/lib/pwa-client'
import { PWA_APP_TITLE } from '@/lib/pwa-standalone-boot'

function lockStandaloneTitle() {
  if (document.title !== PWA_APP_TITLE) {
    document.title = PWA_APP_TITLE
  }
}

/**
 * Keeps the installed PWA window chrome clean — app name only, never route titles
 * like "Home — IRONSTACK" or URLs in the native title bar.
 */
export function PwaWindowChrome() {
  const pathname = usePathname()

  useEffect(() => {
    const standalone = isStandaloneDisplay()
    document.documentElement.classList.toggle('ironstack-pwa', standalone)
    document.body.classList.toggle('ironstack-pwa', standalone)
    if (!standalone) return

    lockStandaloneTitle()

    const titleEl = document.querySelector('title')
    if (!titleEl) return

    const observer = new MutationObserver(lockStandaloneTitle)
    observer.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [pathname])

  return null
}
