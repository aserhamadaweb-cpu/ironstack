'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, House } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExerciseDetailView } from '@/components/exercise-detail-view'
import { HomeProgramBoard, type HomeSplitCard } from '@/components/home-program-board'
import type { LibraryExercise } from '@/lib/exercise-library'
import {
  fetchExerciseDetail,
  type ExerciseDetailDto,
} from '@/lib/exercises/actions'
import { resolveHomePrograms } from '@/lib/home-splits'
import { useDetailsLayerHistory } from '@/lib/use-overlay-history'

type HomeWorkoutsClientProps = {
  library: LibraryExercise[]
  homeCount: number
  yourSplits: HomeSplitCard[]
}

export function HomeWorkoutsClient({
  library,
  homeCount,
  yourSplits,
}: HomeWorkoutsClientProps) {
  const t = useTranslations('homeWorkouts')
  const tCatalog = useTranslations('exerciseCatalog')
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExerciseDetailDto | null>(null)
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  )
  const programs = useMemo(() => resolveHomePrograms(library), [library])

  const closeDetails = useCallback(() => {
    setDetailsId(null)
    setDetail(null)
    setDetailStatus('idle')
  }, [])
  const requestCloseDetails = useDetailsLayerHistory({
    open: Boolean(detailsId),
    onClose: closeDetails,
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!detailsId) return
      event.preventDefault()
      requestCloseDetails()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailsId, requestCloseDetails])

  useEffect(() => {
    if (!detailsId) {
      setDetail(null)
      setDetailStatus('idle')
      return
    }
    let cancelled = false
    setDetailStatus('loading')
    setDetail(null)
    void fetchExerciseDetail(detailsId)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setDetailStatus('error')
          return
        }
        setDetail(data)
        setDetailStatus('idle')
      })
      .catch(() => {
        if (!cancelled) setDetailStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [detailsId])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6">
      <div className={detailsId ? 'hidden' : ''}>
        <HomeWorkoutsHeader count={homeCount} />
      </div>

      <div
        className={detailsId ? 'pointer-events-none invisible absolute' : ''}
        inert={Boolean(detailsId)}
        aria-hidden={Boolean(detailsId)}
        data-tour="home-workouts-list"
      >
        <HomeProgramBoard
          programs={programs}
          yourSplits={yourSplits}
          onOpenExercise={(exercise) => setDetailsId(exercise.id)}
        />
      </div>

      {detailsId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {detailStatus === 'loading' ? (
            <p className="m-auto text-sm text-muted-foreground">
              {tCatalog('loading')}
            </p>
          ) : detailStatus === 'error' || !detail ? (
            <div className="m-auto max-w-sm text-center">
              <p className="text-sm font-semibold text-foreground">
                {tCatalog('loadError')}
              </p>
              <button
                type="button"
                onClick={requestCloseDetails}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-silver/20 px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {t('backToHomeWorkouts')}
              </button>
            </div>
          ) : (
            <ExerciseDetailView
              exercise={detail}
              onBack={requestCloseDetails}
              backLabel={t('backToHomeWorkouts')}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

function HomeWorkoutsHeader({ count }: { count: number }) {
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
            {t('pageIntro', { count })}
          </p>
        </div>
      </div>
    </header>
  )
}
