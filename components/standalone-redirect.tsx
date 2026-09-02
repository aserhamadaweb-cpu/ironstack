'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCachedUserId } from '@/lib/offline/cache'
import { buildAuthEntryHref } from '@/lib/auth-entry'
import { isStandaloneDisplay } from '@/lib/pwa-client'

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
        if (!navigator.onLine) {
          const cachedUser = await getCachedUserId().catch(() => null)
          if (cancelled) return
          window.location.replace(cachedUser ? '/dashboard/home' : buildAuthEntryHref())
          return
        }

        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        if (cancelled) return

        const session = data.session
        const cachedUser = session?.user?.id
          ? session.user.id
          : await getCachedUserId().catch(() => null)

        window.location.replace(cachedUser ? '/dashboard/home' : buildAuthEntryHref())
      } catch {
        const cachedUser = await getCachedUserId().catch(() => null)
        if (!cancelled) {
          window.location.replace(cachedUser ? '/dashboard/home' : buildAuthEntryHref())
        }
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
