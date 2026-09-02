'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, House } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExerciseDetailOverlay } from '@/components/exercise-detail-overlay'
import { HomeProgramBoard, type HomeSplitCard } from '@/components/home-program-board'
import { WorkoutRecommendedSplits } from '@/components/workout-recommended-splits'
import type { LibraryExercise } from '@/lib/exercise-library'
import { isHomeEquipment } from '@/lib/exercises/home-workouts'
import { resolveHomePrograms } from '@/lib/home-splits'
import type { SplitRecommendation } from '@/lib/split-recommendations'
import { useClientExerciseLibrary } from '@/lib/use-client-exercise-library'

type HomeWorkoutsClientProps = {
  yourSplits: HomeSplitCard[]
  recommendedSplits?: SplitRecommendation[]
  recommendedSplitsError?: string | null
  isGuest?: boolean
}

export function HomeWorkoutsClient({
  yourSplits,
  recommendedSplits = [],
  recommendedSplitsError = null,
  isGuest = false,
}: HomeWorkoutsClientProps) {
  const t = useTranslations('homeWorkouts')
  const tCatalog = useTranslations('exerciseCatalog')
  const { library, loading } = useClientExerciseLibrary()
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detailsName, setDetailsName] = useState<string | undefined>(undefined)
  const programs = useMemo(() => resolveHomePrograms(library), [library])
  const homeCount = useMemo(
    () => library.filter((exercise) => isHomeEquipment(exercise.equipment)).length,
    [library],
  )

  const closeDetails = useCallback(() => {
    setDetailsId(null)
    setDetailsName(undefined)
  }, [])

  const openExercise = useCallback((exercise: LibraryExercise) => {
    setDetailsId(exercise.id)
    setDetailsName(exercise.name)
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6">
      <HomeWorkoutsHeader count={loading ? undefined : homeCount} />

      <div data-tour="home-workouts-list">
        <WorkoutRecommendedSplits
          recommendations={recommendedSplits}
          error={recommendedSplitsError}
          isGuest={isGuest}
        />
        {loading ? (
          <div
            className="mt-6 flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-silver/20 bg-card/30"
            role="status"
          >
            <p className="text-sm text-muted-foreground">{tCatalog('loading')}</p>
          </div>
        ) : (
          <HomeProgramBoard
            programs={programs}
            yourSplits={yourSplits}
            onOpenExercise={openExercise}
          />
        )}
      </div>

      {detailsId ? (
        <ExerciseDetailOverlay
          exerciseId={detailsId}
          exerciseName={detailsName}
          onClose={closeDetails}
          backLabel={t('backToHomeWorkouts')}
        />
      ) : null}
    </div>
  )
}

function HomeWorkoutsHeader({ count }: { count?: number }) {
  const t = useTranslations('homeWorkouts')
  return (
    <header className="space-y-3">
      <Link
        href="/dashboard/workout"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold tracking-[0.12em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
        {t('backHome')}
      </Link>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <House className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-3xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {count != null ? t('pageIntro', { count }) : t('pageIntroLoading')}
          </p>
        </div>
      </div>
    </header>
  )
}
