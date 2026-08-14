'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false

  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true

  // Installed PWAs report one of these display modes.
  const modes = ['standalone', 'fullscreen', 'minimal-ui'] as const
  for (const mode of modes) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true
    } catch {
      /* ignore unsupported queries */
    }
  }

  return false
}

type StandaloneRedirectProps = {
  children: React.ReactNode
}

/**
 * Installed PWA launches skip marketing and go to the app or login.
 * Regular browser tabs render the landing page unchanged.
 */
export function StandaloneRedirect({ children }: StandaloneRedirectProps) {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const standalone = isStandaloneDisplay()

      if (!standalone) {
        if (!cancelled) setChecking(false)
        return
      }

      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        if (cancelled) return

        const session = data.session

        // Hard navigation so we never leave marketing in history or soft-nav back.
        window.location.replace(session ? '/dashboard' : '/login')
      } catch {
        if (!cancelled) window.location.replace('/login')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  // Blank until we know this is a normal browser tab (or we've navigated away).
  if (checking) {
    return (
      <div
        className="min-h-svh bg-background"
        role="status"
        aria-live="polite"
        aria-label="Opening IronStack"
      >
        <span className="sr-only">Opening IronStack…</span>
      </div>
    )
  }

  return <>{children}</>
}
