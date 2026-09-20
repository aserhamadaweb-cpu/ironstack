'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SplitBuilder } from '@/components/split-builder'
import { initialsFrom } from '@/lib/dashboard-utils'
import { loadExerciseLibraryOffline } from '@/lib/exercise-library.client'
import type { LibraryExercise } from '@/lib/exercise-library'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import {
  cacheExerciseLibrary,
  getCachedSplits,
  getCachedUserId,
  getHomeSnapshot,
} from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { EmptyState } from '@/components/page-states'
import { Layers } from 'lucide-react'

type CreateSplitClientProps = {
  library?: LibraryExercise[]
  displayName?: string
  initials?: string
  customSplitCount?: number
  defaultHomeLibrary?: boolean
  /** After first save from onboarding, send athlete into the app tour. */
  startTourAfterSave?: boolean
}

export function CreateSplitClient({
  library = [],
  displayName: displayNameProp,
  initials: initialsProp,
  customSplitCount,
  defaultHomeLibrary = false,
  startTourAfterSave = false,
}: CreateSplitClientProps) {
  const t = useTranslations('offline')
  const { online, hydrated } = useOfflineStatus()
  const [catalog, setCatalog] = useState(library)
  const [displayName, setDisplayName] = useState(displayNameProp ?? 'Athlete')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [count, setCount] = useState(customSplitCount ?? 0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(
    library.length > 0 ? 'ready' : 'loading',
  )

  useEffect(() => {
    if (library.length > 0) {
      void cacheExerciseLibrary(library)
      setCatalog(library)
      setStatus('ready')
    }
  }, [library])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [snapshot, uid, splits] = await Promise.all([
        getHomeSnapshot().catch(() => null),
        getCachedUserId().catch(() => null),
        getCachedSplits().catch(() => []),
      ])
      if (cancelled) return
      const name = displayNameProp || snapshot?.displayName || 'Athlete'
      setDisplayName(name)
      if (snapshot?.avatarUrl) setAvatarUrl(snapshot.avatarUrl)
      if (customSplitCount == null) {
        setCount(
          splits.filter((row) => row.row.user_id === uid && !row.row.is_system)
            .length,
        )
      }
      if (library.length > 0) return
      try {
        const rows = await loadExerciseLibraryOffline()
        if (cancelled) return
        if (rows.length === 0) {
          setStatus('missing')
          return
        }
        setCatalog(rows)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('missing')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customSplitCount, displayNameProp, library.length])

  if (hydrated && !online) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        <BackToTrainLink />
        <EmptyState
          icon={Layers}
          title={t('floorPaused5')}
          body={t('splitRequiresConnection')}
          actionLabel={t('openWorkout')}
          actionHref="/dashboard/workout"
        />
      </main>
    )
  }

  if (status === 'loading') {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        <BackToTrainLink />
        <p className="text-sm text-muted-foreground">{t('libraryLoading')}</p>
      </main>
    )
  }

  if (status === 'missing') {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        <BackToTrainLink />
        <p className="text-sm text-muted-foreground">{t('libraryMissing')}</p>
      </main>
    )
  }

  return (
    <SplitBuilder
      library={catalog}
      displayName={displayName}
      initials={initialsProp || initialsFrom(displayName)}
      avatarUrl={avatarUrl}
      customSplitCount={count}
      maxCustomSplits={MAX_CUSTOM_SPLITS}
      defaultHomeLibrary={defaultHomeLibrary}
      startTourAfterSave={startTourAfterSave}
    />
  )
}
