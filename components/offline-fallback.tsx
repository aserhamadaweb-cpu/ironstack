'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { OfflineFloorHome } from '@/components/offline-floor-home'
import { initialsFrom } from '@/lib/dashboard-utils'
import { markNavigationIntent } from '@/lib/navigation-intent'
import { getHomeSnapshot } from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const ONLINE_STABLE_MS = 800

/**
 * Offline document shell (`/offline` and PWA navigation fallback).
 * Always renders the gym-floor experience when offline — never a dead-end screen.
 */
export function OfflineFallback() {
  const router = useRouter()
  const tCommon = useTranslations('common')
  const tHome = useTranslations('home')
  const tDays = useTranslations('days')
  const { online, hydrated } = useOfflineStatus()
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getHomeSnapshot>
  > | null>(null)
  const [snapshotReady, setSnapshotReady] = useState(false)
  const redirectedRef = useRef(false)

  const defaultWeek = useMemo(
    () => DAY_KEYS.map((key) => ({ day: tDays(key), done: false })),
    [tDays],
  )

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
    if (!hydrated || !online || redirectedRef.current) return

    const timer = window.setTimeout(() => {
      if (!navigator.onLine || redirectedRef.current) return

      const returnTo = (() => {
        try {
          const fromQuery = new URLSearchParams(window.location.search).get(
            'return',
          )
          if (fromQuery?.startsWith('/') && !fromQuery.startsWith('//')) {
            return fromQuery
          }
          const stored = sessionStorage.getItem('ironstack:return-path')
          if (stored?.startsWith('/') && !stored.startsWith('//')) {
            return stored
          }
        } catch {
          /* ignore */
        }
        return null
      })()

      const destination = returnTo ?? '/dashboard/home'
      redirectedRef.current = true
      markNavigationIntent(destination)
      router.replace(destination)
    }, ONLINE_STABLE_MS)

    return () => window.clearTimeout(timer)
  }, [hydrated, online, router])

  if (!hydrated || !snapshotReady) {
    return (
      <div
        className="min-h-svh bg-background"
        role="status"
        aria-label="Opening IronStack"
      />
    )
  }

  if (online) {
    return (
      <div
        className="min-h-svh bg-background"
        role="status"
        aria-label="Opening IronStack"
      />
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
