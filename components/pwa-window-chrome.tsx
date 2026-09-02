'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isStandaloneDisplay } from '@/lib/pwa-client'

const PWA_TITLE = 'IronStack'

/**
 * In the installed app the window title is the only place route titles surface,
 * so keep it as the app name instead of "Home — IRONSTACK".
 */
export function PwaWindowChrome() {
  const pathname = usePathname()

  useEffect(() => {
    const standalone = isStandaloneDisplay()
    document.body.classList.toggle('ironstack-pwa', standalone)
    if (standalone) {
      document.title = PWA_TITLE
    }
  }, [pathname])

  return null
}
