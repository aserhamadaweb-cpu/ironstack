'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { OfflineFloorHome } from '@/components/offline-floor-home'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getHomeSnapshot } from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/**
 * Offline gym-floor: Profile / Settings are unavailable — show Home floor
 * instead of a blank shell + router.replace (which the SW remaps to /offline).
 */
export function OfflineHomeRedirect({ children }: { children: ReactNode }) {
  const tCommon = useTranslations('common')
  const tHome = useTranslations('home')
  const tDays = useTranslations('days')
  const { online, hydrated } = useOfflineStatus()
  const offline = hydrated && !online
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getHomeSnapshot>
  > | null>(null)
  const [snapshotReady, setSnapshotReady] = useState(false)

  const defaultWeek = useMemo(
    () => DAY_KEYS.map((key) => ({ day: tDays(key), done: false })),
    [tDays],
  )

  useEffect(() => {
    if (!offline) return
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
  }, [offline])

  if (!hydrated) {
    return (
      <div
        className="min-h-svh bg-background"
        role="status"
        aria-label="Opening IronStack"
      />
    )
  }

  if (offline) {
    if (!snapshotReady) {
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
        lastSessionCaption={
          snapshot?.lastSessionCaption ?? tHome('noSessionsYet')
        }
      />
    )
  }

  return <>{children}</>
}
