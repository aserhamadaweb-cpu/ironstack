'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CloudUpload, Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SplitBuilder, type SplitBuilderInitial } from '@/components/split-builder'
import { SplitDetailPage } from '@/components/split-detail-page'
import { EmptyState, PageLoading } from '@/components/page-states'
import { CTA_SECONDARY } from '@/lib/accent'
import { formatTargetReps } from '@/lib/split-reps'
import { loadExerciseLibraryOffline } from '@/lib/exercise-library.client'
import type { LibraryExercise } from '@/lib/exercise-library'
import { useOfflineStatus } from '@/lib/offline/provider'
import { listUnsyncedSplitMutations, resolveSplitForSession } from '@/lib/offline/split-store'
import type { CachedSplit } from '@/lib/offline/db'

function toBuilderInitial(split: CachedSplit): SplitBuilderInitial {
  const days = [...(split.row.split_days ?? [])].sort(
    (a, b) => a.day_order - b.day_order,
  )
  return {
    name: split.detail.name,
    description: split.detail.description,
    daysPerWeek: split.detail.daysPerWeek,
    days: days.map((day, dayIndex) => ({
      id: day.id || `day-${dayIndex}`,
      name: day.name,
      subtitle: day.subtitle,
      exercises: [...(day.split_day_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .map((exercise, exIndex) => ({
          uid: exercise.id || `ex-${dayIndex}-${exIndex}`,
          exercise: {
            id: exercise.lift_type_id,
            name: exercise.lift_types?.name ?? 'Exercise',
            muscles: exercise.lift_types?.muscle_group
              ? [exercise.lift_types.muscle_group]
              : [],
            equipment: 'None',
            level: '',
            category: exercise.lift_types?.category ?? null,
            image: exercise.lift_types?.image_url ?? null,
          },
          sets: exercise.target_sets || 3,
          reps: formatTargetReps(
            exercise.target_reps_min,
            exercise.target_reps_max,
            exercise.lift_types?.category === 'cardio' ? '30' : '8–12',
          ),
          setType: 'normal' as const,
        })),
    })),
  }
}

function SyncingBanner({ pending }: { pending: boolean }) {
  const t = useTranslations('offline')
  if (!pending) return null
  return (
    <div className="mx-auto mb-4 flex max-w-3xl items-center gap-2 rounded-2xl border border-gold/30 bg-gold-tint px-4 py-3 text-sm text-gold">
      <CloudUpload className="size-4 shrink-0" aria-hidden="true" />
      {t('stillSyncingSplit')}
    </div>
  )
}

export function SplitDetailGate({
  slug,
  displayName,
  initials,
  avatarUrl,
  viewerUserId,
}: {
  slug: string
  displayName: string
  initials: string
  avatarUrl?: string | null
  viewerUserId: string
}) {
  const t = useTranslations('offline')
  const { syncing, refresh } = useOfflineStatus()
  const [cached, setCached] = useState<CachedSplit | null | undefined>(undefined)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [split, mutations] = await Promise.all([
        resolveSplitForSession(slug),
        listUnsyncedSplitMutations().catch(() => []),
      ])
      if (cancelled) return
      setCached(split)
      setPending(
        mutations.some(
          (row) => row.splitId === split?.id || row.splitId === slug,
        ),
      )
      if (split && typeof navigator !== 'undefined' && navigator.onLine) {
        void refresh()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, slug])

  if (cached === undefined) {
    return <PageLoading label={t('stillSyncingSplit')} />
  }

  if (cached) {
    return (
      <div className="pt-4">
        <SyncingBanner pending={pending || syncing} />
        <SplitDetailPage
          split={cached.detail}
          displayName={displayName}
          initials={initials}
          avatarUrl={avatarUrl}
          viewerUserId={viewerUserId || cached.row.user_id || ''}
        />
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <EmptyState
        icon={Layers}
        title={t('splitMissingTitle')}
        body={pending || syncing ? t('stillSyncingSplit') : t('splitMissingBody')}
        actionLabel={t('openWorkout')}
        actionHref="/dashboard/workout"
      />
    </main>
  )
}

export function SplitEditGate({
  slug,
  displayName,
  initials,
  avatarUrl,
}: {
  slug: string
  displayName: string
  initials: string
  avatarUrl?: string | null
}) {
  const t = useTranslations('offline')
  const { online, hydrated, syncing, refresh } = useOfflineStatus()
  const [cached, setCached] = useState<CachedSplit | null | undefined>(undefined)
  const [library, setLibrary] = useState<LibraryExercise[]>([])
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [split, mutations, catalog] = await Promise.all([
        resolveSplitForSession(slug),
        listUnsyncedSplitMutations().catch(() => []),
        loadExerciseLibraryOffline().catch(() => [] as LibraryExercise[]),
      ])
      if (cancelled) return
      setCached(split)
      setLibrary(catalog)
      setPending(
        mutations.some(
          (row) => row.splitId === split?.id || row.splitId === slug,
        ),
      )
      if (split && typeof navigator !== 'undefined' && navigator.onLine) {
        void refresh()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, slug])

  if (cached === undefined) {
    return <PageLoading label={t('stillSyncingSplit')} />
  }

  if (hydrated && !online) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
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

  if (cached) {
    if (library.length === 0) {
      return (
        <main className="mx-auto max-w-3xl px-6 py-16">
          <EmptyState
            icon={Layers}
            title={t('splitMissingTitle')}
            body={t('libraryMissing')}
            actionLabel={t('retry')}
            actionHref={`/dashboard/splits/${slug}/edit`}
          />
        </main>
      )
    }
    return (
      <div className="pt-4">
        <SyncingBanner pending={pending || syncing} />
        <SplitBuilder
          library={library}
          displayName={displayName}
          initials={initials}
          avatarUrl={avatarUrl}
          mode="edit"
          editSplitId={cached.id}
          initial={toBuilderInitial(cached)}
        />
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <EmptyState
        icon={Layers}
        title={t('splitMissingTitle')}
        body={pending || syncing ? t('stillSyncingSplit') : t('splitMissingBody')}
        actionLabel={t('openWorkout')}
        actionHref="/dashboard/workout"
      />
      <div className="mt-4 text-center">
        <Link href="/dashboard/workout" className={CTA_SECONDARY}>
          {t('retry')}
        </Link>
      </div>
    </main>
  )
}
