'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExerciseDetailView } from '@/components/exercise-detail-view'
import { exerciseToLibraryExercise } from '@/lib/exercises/adapters'
import {
  addExerciseToActiveSplitDraft,
  peekSplitDraftTarget,
} from '@/lib/split-builder-draft'
import type { Exercise } from '@/lib/exercises/types'

type ExerciseDetailClientProps = {
  exercise: Exercise
}

const FROM_ALLOWLIST = [
  '/dashboard/exercises',
  '/dashboard/home-workouts',
  '/dashboard/workout',
  '/dashboard/splits/create',
]

function safeFrom(raw: string | null): string {
  if (!raw) return '/dashboard/exercises'
  if (!raw.startsWith('/dashboard/')) return '/dashboard/exercises'
  if (raw.startsWith('//')) return '/dashboard/exercises'
  if (
    FROM_ALLOWLIST.some((path) => raw === path || raw.startsWith(`${path}?`)) ||
    /^\/dashboard\/splits\/[^/]+\/edit$/.test(raw)
  ) {
    return raw
  }
  return '/dashboard/exercises'
}

export function ExerciseDetailClient({ exercise }: ExerciseDetailClientProps) {
  const t = useTranslations('exerciseCatalog')
  const searchParams = useSearchParams()
  const backHref = safeFrom(searchParams.get('from'))
  const { source, ...detail } = exercise
  void source
  const [added, setAdded] = useState(false)
  const draftTarget = useMemo(() => peekSplitDraftTarget(), [])
  const addingTo = draftTarget
    ? t('addingToDay', {
        day: draftTarget.dayName.trim() || String(draftTarget.dayIndex + 1),
      })
    : undefined
  const backLabel =
    backHref.startsWith('/dashboard/home-workouts')
      ? t('backToCatalog')
      : t('backToCatalog')

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold tracking-[0.12em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
        {backLabel}
      </Link>
      <ExerciseDetailView
        exercise={detail}
        onAdd={() => {
          addExerciseToActiveSplitDraft(exerciseToLibraryExercise(exercise))
          setAdded(true)
        }}
        added={added}
        addingTo={addingTo}
      />
    </div>
  )
}
