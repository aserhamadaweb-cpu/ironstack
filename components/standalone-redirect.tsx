'use client'

import { useEffect, useState } from 'react'
import { readServerSessionClient } from '@/lib/auth/read-server-session'
import { getCachedUserId } from '@/lib/offline/cache'
import { buildAuthEntryHref, buildLoginPath } from '@/lib/auth-entry'
import { LOCALE_CHOSEN_COOKIE } from '@/lib/i18n'
import { isStandaloneDisplay } from '@/lib/pwa-client'

type StandaloneRedirectProps = {
  children: React.ReactNode
}

function hasChosenLocaleClient(): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.cookie
      .split(';')
      .some((part) => part.trim() === `${LOCALE_CHOSEN_COOKIE}=1`)
  } catch {
    return false
  }
}

function authEntryHref(): string {
  return hasChosenLocaleClient() ? buildLoginPath() : buildAuthEntryHref()
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
          window.location.replace(
            cachedUser ? '/dashboard/home' : authEntryHref(),
          )
          return
        }

        const server = await readServerSessionClient()
        if (cancelled) return

        if (server?.userId) {
          window.location.replace('/dashboard/home')
          return
        }

        const cachedUser = await getCachedUserId().catch(() => null)
        window.location.replace(
          cachedUser ? '/dashboard/home' : authEntryHref(),
        )
      } catch {
        const cachedUser = await getCachedUserId().catch(() => null)
        if (!cancelled) {
          window.location.replace(
            cachedUser ? '/dashboard/home' : authEntryHref(),
          )
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

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
