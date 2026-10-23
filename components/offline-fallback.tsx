'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Wifi } from 'lucide-react'
import { OfflineFloorHome } from '@/components/offline-floor-home'
import { CTA_PRIMARY, CTA_SECONDARY } from '@/lib/accent'
import { initialsFrom } from '@/lib/dashboard-utils'
import { hardNavigate } from '@/lib/navigation-intent'
import { getHomeSnapshot } from '@/lib/offline/cache'
import { useEmbeddedSessionActive } from '@/lib/offline/embedded-session'
import { useOfflineStatus } from '@/lib/offline/provider'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const ONLINE_STABLE_MS = 1500

function isSafeAppPath(path: string | null | undefined): path is string {
  return Boolean(path?.startsWith('/') && !path.startsWith('//'))
}

/**
 * Prefer the SW `?return=` target from the failed navigation.
 * sessionStorage is only a last resort and is cleared after use so it cannot
 * yank the user back to an old page (e.g. Profile) minutes later.
 */
function readReturnPath(): string | null {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('return')
    if (isSafeAppPath(fromQuery)) return fromQuery
    const stored = sessionStorage.getItem('ironstack:return-path')
    if (isSafeAppPath(stored) && stored !== '/offline') return stored
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Offline document shell (`/offline` and PWA navigation fallback).
 * Always render the Home floor UI offline — never router.replace into a
 * server session route while offline (that fails and caused blank screens).
 *
 * When the browser still reports online (slow/flaky — not fully offline), do
 * not blank + silent-replace: show an honest connection message with Retry.
 */
export function OfflineFallback() {
  const router = useRouter()
  const tCommon = useTranslations('common')
  const tHome = useTranslations('home')
  const tDays = useTranslations('days')
  const tConnection = useTranslations('connection')
  const { online, hydrated } = useOfflineStatus()
  const embeddedSession = useEmbeddedSessionActive()
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getHomeSnapshot>
  > | null>(null)
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const redirectedRef = useRef(false)
  const wasOfflineRef = useRef(false)

  const defaultWeek = useMemo(
    () => DAY_KEYS.map((key) => ({ day: tDays(key), done: false })),
    [tDays],
  )

  useEffect(() => {
    setReturnTo(readReturnPath())
  }, [])

  useEffect(() => {
    let cancelled = false
    void getHomeSnapshot()
      .then((value) => {
        if (!cancelled) setSnapshot(value)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null)
      })
      .finally(() => {
        if (!cancelled) setSnapshotReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!online) {
      wasOfflineRef.current = true
      redirectedRef.current = false
      return
    }
    // Only auto-leave /offline after a real offline → online transition.
    // Landing here while already "online" (failed navigate / flaky net) must
    // not silently bounce via router.replace.
    if (!wasOfflineRef.current || redirectedRef.current || embeddedSession) {
      return
    }

    const timer = window.setTimeout(() => {
      if (!navigator.onLine || redirectedRef.current || embeddedSession) return
      if (window.location.pathname !== '/offline') return

      const destination =
        returnTo && isSafeAppPath(returnTo) ? returnTo : '/dashboard/home'
      redirectedRef.current = true
      try {
        sessionStorage.removeItem('ironstack:return-path')
      } catch {
        /* ignore */
      }
      router.replace(destination)
    }, ONLINE_STABLE_MS)

    return () => window.clearTimeout(timer)
  }, [hydrated, online, router, embeddedSession, returnTo])

  const retryReturn = () => {
    const destination =
      returnTo && isSafeAppPath(returnTo) ? returnTo : '/dashboard/home'
    hardNavigate(destination)
  }

  if (!hydrated || !snapshotReady) {
    return (
      <div
        className="min-h-svh bg-background"
        role="status"
        aria-label="Opening IronStack"
      />
    )
  }

  // Flaky/slow: browser says online but we are on the offline shell.
  if (online && !embeddedSession && !wasOfflineRef.current) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/35 bg-gold/10 text-gold">
          <Wifi className="size-6" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-xl font-bold text-headline">
          {tConnection('failedTitle')}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tConnection('failedBody')}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={retryReturn}
            className={`${CTA_PRIMARY} inline-flex min-h-11 items-center px-5`}
          >
            {tConnection('retry')}
          </button>
          <button
            type="button"
            onClick={() => {
              hardNavigate('/dashboard/home')
            }}
            className={`${CTA_SECONDARY} inline-flex min-h-11 items-center px-5`}
          >
            {tConnection('goHome')}
          </button>
        </div>
      </main>
    )
  }

  if (online && !embeddedSession) {
    return (
      <div
        className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6"
        role="status"
        aria-label={tConnection('loadingTitle')}
      >
        <Loader2 className="size-7 animate-spin text-gold" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{tConnection('reconnecting')}</p>
      </div>
    )
  }

  const displayName = snapshot?.displayName?.trim() || tCommon('athlete')

  return (
    <OfflineFloorHome
      displayName={displayName}
      initials={initialsFrom(displayName)}
      avatarUrl={snapshot?.avatarUrl}
      isGuest={snapshot?.isGuest ?? false}
      weekActivity={
        snapshot?.weekActivity?.length ? snapshot.weekActivity : defaultWeek
      }
      lastSessionCaption={snapshot?.lastSessionCaption ?? tHome('noSessionsYet')}
    />
  )
}
