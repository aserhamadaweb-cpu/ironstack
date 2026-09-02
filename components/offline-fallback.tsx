'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, Dumbbell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { OfflineFloorHome } from '@/components/offline-floor-home'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getCachedSplits, getHomeSnapshot } from '@/lib/offline/cache'
import { OfflineProvider, useOfflineStatus } from '@/lib/offline/provider'

function OfflineFallbackInner() {
  const t = useTranslations('offline')
  const router = useRouter()
  const { online, hydrated } = useOfflineStatus()
  const [splits, setSplits] = useState<Array<{ slug: string; name: string }>>([])
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getHomeSnapshot>
  >>(null)

  useEffect(() => {
    void getCachedSplits()
      .then((rows) =>
        setSplits(rows.map((row) => ({ slug: row.detail.slug, name: row.detail.name }))),
      )
      .catch(() => setSplits([]))
    void getHomeSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
  }, [])

  useEffect(() => {
    if (!hydrated || !online) return
    const returnTo = (() => {
      try {
        const fromQuery = new URLSearchParams(window.location.search).get('return')
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

    if (window.location.pathname === '/offline') {
      router.replace(returnTo ?? '/dashboard/home')
      return
    }

    if (returnTo && returnTo !== window.location.pathname) {
      router.replace(returnTo)
      return
    }

    router.refresh()
  }, [hydrated, online, router])

  if (!hydrated) {
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

  if (snapshot) {
    return (
      <OfflineFloorHome
        displayName={snapshot.displayName}
        initials={initialsFrom(snapshot.displayName)}
        avatarUrl={snapshot.avatarUrl}
        isGuest={snapshot.isGuest}
        weekActivity={snapshot.weekActivity}
        lastSessionCaption={snapshot.lastSessionCaption}
      />
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <CloudOff className="size-10 text-gold" aria-hidden="true" />
      <h1 className="font-heading text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('body')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/dashboard/workout"
          className="btn-pill btn-pill-primary inline-flex min-h-11 items-center px-8 text-xs tracking-[0.2em]"
        >
          {t('openWorkout')}
        </a>
        <a
          href="/dashboard/home"
          className="inline-flex min-h-11 items-center px-4 text-xs font-semibold tracking-[0.16em] text-muted-foreground"
        >
          {t('retry')}
        </a>
      </div>
      {splits.length > 0 ? (
        <div className="w-full max-w-sm text-start">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-muted-foreground">
            <Dumbbell className="size-4 text-gold" aria-hidden="true" />
            {t('cachedSplits')}
          </p>
          <ul className="space-y-2">
            {splits.map((split) => (
              <li key={split.slug}>
                <a
                  href={`/dashboard/splits/${split.slug}/session`}
                  className="block rounded-xl border border-silver/20 bg-card px-4 py-3 text-sm font-semibold"
                >
                  {split.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="max-w-sm text-xs text-muted-foreground">{t('noCache')}</p>
      )}
    </main>
  )
}

export function OfflineFallback() {
  return (
    <OfflineProvider>
      <OfflineFallbackInner />
    </OfflineProvider>
  )
}
