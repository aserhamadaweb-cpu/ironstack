'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ActiveSession } from '@/components/active-session'
import { EmptyState, PageLoading } from '@/components/page-states'
import {
  getCachedPersonalRecords,
  recordsToPreviousBests,
  refreshWorkoutCache,
} from '@/lib/offline/cache'
import { OFFLINE_CHANGED_EVENT } from '@/lib/offline/session-store'
import { resolveSplitForSession } from '@/lib/offline/split-store'
import type { SplitDetail } from '@/lib/split-data'
import type { WeightUnit } from '@/lib/units'

type PreviousBest = {
  weight: number
  reps: number
  durationSeconds?: number | null
}

type ActiveSessionGateProps = {
  slug: string
  displayName: string
  initials: string
  avatarUrl?: string | null
  isFirstEver: boolean
  weightUnit: WeightUnit
  initialSplit?: SplitDetail | null
  initialBests?: Record<string, PreviousBest>
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function ActiveSessionGate({
  slug,
  displayName,
  initials,
  avatarUrl,
  isFirstEver,
  weightUnit,
  initialSplit = null,
  initialBests = {},
}: ActiveSessionGateProps) {
  const t = useTranslations('offline')
  const [split, setSplit] = useState<SplitDetail | null>(initialSplit)
  const [bests, setBests] = useState(initialBests)
  const [loading, setLoading] = useState(!initialSplit)

  const loadSplit = useCallback(
    async (withRetries: boolean) => {
      const delays = withRetries ? [0, 200, 700] : [0]
      for (const delay of delays) {
        if (delay) await wait(delay)
        try {
          const cached = await resolveSplitForSession(slug)
          if (!cached) continue
          const records = await getCachedPersonalRecords().catch(() => [])
          setSplit((current) => current ?? cached.detail)
          setBests((current) =>
            Object.keys(current).length > 0
              ? current
              : recordsToPreviousBests(records),
          )
          setLoading(false)
          return true
        } catch {
          /* IndexedDB can be briefly unavailable during navigation */
        }
      }
      return false
    },
    [slug],
  )

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (initialSplit) {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          void refreshWorkoutCache().catch(() => false)
        }
        return
      }

      setLoading(true)
      const hit = await loadSplit(true)
      if (cancelled) return
      if (hit) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          void refreshWorkoutCache().catch(() => false)
        }
        return
      }
      setLoading(false)
    })()

    const onChange = () => {
      if (cancelled) return
      void loadSplit(false)
    }
    window.addEventListener(OFFLINE_CHANGED_EVENT, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(OFFLINE_CHANGED_EVENT, onChange)
    }
  }, [initialSplit, loadSplit])

  if (loading) {
    return <PageLoading label={t('stillSyncingSplit')} />
  }

  if (!split) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          icon={Layers}
          title={t('splitMissingTitle')}
          body={t('splitMissingBody')}
          actionLabel={t('openWorkout')}
          actionHref="/dashboard/workout"
        />
      </main>
    )
  }

  return (
    <ActiveSession
      split={split}
      displayName={displayName}
      initials={initials}
      avatarUrl={avatarUrl}
      isFirstEver={isFirstEver}
      previousBests={bests}
      weightUnit={weightUnit}
    />
  )
}
