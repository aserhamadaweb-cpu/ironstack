'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Layers } from 'lucide-react'
import { EmptyState } from '@/components/page-states'
import {
  WorkoutSplitCard,
  type WorkoutSplitCardData,
} from '@/components/workout-split-card'
import { ActiveWorkoutConflict } from '@/components/active-workout-conflict'
import { SplitShareSheet } from '@/components/split-share-sheet'
import { useGuestGate } from '@/components/guest-gate-provider'
import { deleteCustomSplit, setSplitShared } from '@/lib/data/save-split'
import { setPrimarySplitAction } from '@/lib/data/split-recommendation-actions'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import { createSplitChoiceHref } from '@/lib/split-create-paths'
import { patchCachedSplitShared, refreshWorkoutCache } from '@/lib/offline/cache'
import { removeLocalSplit } from '@/lib/offline/split-store'
import { useOfflineStatus } from '@/lib/offline/provider'
import { useActiveWorkout } from '@/lib/use-active-workout'

type MySplitsCustomSectionProps = {
  splits: WorkoutSplitCardData[]
  primarySplitId: string | null
}

export function MySplitsCustomSection({
  splits: initialSplits,
  primarySplitId: initialPrimaryId,
}: MySplitsCustomSectionProps) {
  const t = useTranslations('workout')
  const tOffline = useTranslations('offline')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const { online, hydrated } = useOfflineStatus()
  const offline = hydrated && !online
  const [splits, setSplits] = useState(initialSplits)
  const [primarySplitId, setPrimarySplitId] = useState(initialPrimaryId)
  const [sharedMap, setSharedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialSplits.map((s) => [s.id, Boolean(s.isShared)])),
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { active: activeWorkout } = useActiveWorkout()
  const [startBlocked, setStartBlocked] = useState(false)
  const [shareSheetSplit, setShareSheetSplit] = useState<WorkoutSplitCardData | null>(
    null,
  )

  useEffect(() => {
    setSplits(initialSplits)
    setPrimarySplitId(initialPrimaryId)
    setSharedMap((prev) => ({
      ...prev,
      ...Object.fromEntries(initialSplits.map((s) => [s.id, Boolean(s.isShared)])),
    }))
  }, [initialSplits, initialPrimaryId])

  const sortedSplits = useMemo(() => {
    return [...splits].sort((a, b) => {
      const aPrimary =
        a.id === primarySplitId || a.slug === primarySplitId ? 0 : 1
      const bPrimary =
        b.id === primarySplitId || b.slug === primarySplitId ? 0 : 1
      return aPrimary - bPrimary
    })
  }, [splits, primarySplitId])

  const startSplit = (slug: string) => {
    requireAccount('startSession', () => {
    if (activeWorkout && activeWorkout.splitId !== slug) {
      setStartBlocked(true)
      return
    }
    router.push(`/dashboard/splits/${slug}/session`)
    })
  }

  const handleDelete = (splitId: string, splitName: string) => {
    if (deletingId || pending) return
    requireAccount('editSplit', () => {
    if (offline) {
      setError(tOffline('splitRequiresConnection'))
      return
    }
    if (!window.confirm(t('deleteConfirm', { name: splitName, max: MAX_CUSTOM_SPLITS }))) {
      return
    }
    setError(null)
    setDeletingId(splitId)
    startTransition(async () => {
      const previous = splits
      setSplits((prev) => prev.filter((s) => s.id !== splitId))
      try {
        const result = await deleteCustomSplit(splitId)
        if (result.error) {
          setSplits(previous)
          setError(result.error)
          return
        }
        if (primarySplitId === splitId) setPrimarySplitId(null)
        try {
          await removeLocalSplit(splitId)
          await refreshWorkoutCache()
        } catch {
          /* best-effort */
        }
        router.refresh()
      } catch (err) {
        setSplits(previous)
        setError(err instanceof Error ? err.message : 'Could not delete that split.')
      } finally {
        setDeletingId(null)
      }
    })
    })
  }

  const handleShareToggle = (splitId: string) => {
    if (sharingId || pending) return
    requireAccount('shareSplit', () => {
    if (offline) {
      setError(tOffline('splitRequiresConnection'))
      return
    }
    const next = !sharedMap[splitId]
    setError(null)
    setSharingId(splitId)
    setSharedMap((prev) => ({ ...prev, [splitId]: next }))
    startTransition(async () => {
      const result = await setSplitShared(splitId, next)
      setSharingId(null)
      if (result.error) {
        setSharedMap((prev) => ({ ...prev, [splitId]: !next }))
        setError(result.error)
        return
      }
      setSplits((prev) =>
        prev.map((split) =>
          split.id === splitId ? { ...split, isShared: next } : split,
        ),
      )
      try {
        await patchCachedSplitShared(splitId, next)
        await refreshWorkoutCache()
      } catch {
        /* best-effort */
      }
      router.refresh()
    })
    })
  }

  const handleSetPrimary = (splitId: string) => {
    if (primaryId || pending) return
    requireAccount('saveSplit', () => {
    if (offline) {
      setError(tOffline('splitRequiresConnection'))
      return
    }
    setError(null)
    setPrimaryId(splitId)
    startTransition(async () => {
      const result = await setPrimarySplitAction(splitId)
      setPrimaryId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPrimarySplitId(splitId)
      router.refresh()
    })
    })
  }

  const openShareSheet = (split: WorkoutSplitCardData) => {
    requireAccount('shareSplit', () => {
      setShareSheetSplit(split)
    })
  }

  return (
    <>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {startBlocked && activeWorkout ? (
        <ActiveWorkoutConflict
          active={activeWorkout}
          onResolved={() => setStartBlocked(false)}
          onStay={() => setStartBlocked(false)}
        />
      ) : null}

      {sortedSplits.length === 0 ? (
        offline ? (
          <EmptyState
            icon={Layers}
            title={t('noSplits')}
            body={tOffline('splitRequiresConnection')}
            tone="gold"
          />
        ) : (
          <EmptyState
            icon={Layers}
            title={t('noSplits')}
            body={t('noSplitsBody')}
            actionLabel={t('createSplit')}
            actionHref={createSplitChoiceHref()}
            tone="gold"
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sortedSplits.map((split) => (
            <WorkoutSplitCard
              key={split.id}
              split={split}
              primarySplitId={primarySplitId}
              isShared={Boolean(sharedMap[split.id] ?? split.isShared)}
              onStart={startSplit}
              onDelete={handleDelete}
              onShareToggle={handleShareToggle}
              onOpenShare={(split) => {
                if (offline) {
                  setError(tOffline('splitRequiresConnection'))
                  return
                }
                openShareSheet(split)
              }}
              onSetPrimary={handleSetPrimary}
              deleting={deletingId === split.id}
              sharing={sharingId === split.id}
              settingPrimary={primaryId === split.id}
              pending={pending}
            />
          ))}
        </div>
      )}

      {shareSheetSplit ? (
        <SplitShareSheet
          open
          onClose={() => {
            setShareSheetSplit(null)
            setSharedMap((prev) => ({
              ...prev,
              [shareSheetSplit.id]: true,
            }))
            router.refresh()
          }}
          splitId={shareSheetSplit.id}
          splitName={shareSheetSplit.name}
          daysPerWeek={shareSheetSplit.days}
          category={shareSheetSplit.focus}
        />
      ) : null}
    </>
  )
}
