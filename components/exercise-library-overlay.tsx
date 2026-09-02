'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ExercisePicker } from '@/components/exercise-picker'
import { ExerciseDetailView } from '@/components/exercise-detail-view'
import { HomeWorkoutFilters } from '@/components/home-workout-filters'
import { EASE } from '@/components/reveal'
import {
  libraryToCatalogItem,
  type ExerciseCatalogItem,
} from '@/lib/exercise-catalog'
import type { LibraryExercise } from '@/lib/exercise-library'
import { loadExerciseDetail } from '@/lib/exercises/fetch-detail-client'
import type { ExerciseDetailDto } from '@/lib/exercises/actions'
import {
  filterHomeExercises,
  isHomeExercise,
  type HomeWorkoutQuery,
} from '@/lib/exercises/home-workouts'
import { useOverlayHistory } from '@/lib/use-overlay-history'

type ExerciseLibraryOverlayProps = {
  library: LibraryExercise[]
  dayName: string
  addedCount: number
  onAdd: (exercise: LibraryExercise) => void
  onClose: () => void
  initialHomeOnly?: boolean
}

export function ExerciseLibraryOverlay({
  library,
  dayName,
  addedCount,
  onAdd,
  onClose,
  initialHomeOnly = false,
}: ExerciseLibraryOverlayProps) {
  const t = useTranslations('splitBuilder')
  const tPicker = useTranslations('exercisePicker')
  const tCatalog = useTranslations('exerciseCatalog')
  const tHome = useTranslations('homeWorkouts')
  const reduce = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExerciseDetailDto | null>(null)
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  )
  const [detailsAdded, setDetailsAdded] = useState(false)
  const [homeOnly, setHomeOnly] = useState(initialHomeOnly)
  const [homeQuery, setHomeQuery] = useState<HomeWorkoutQuery>({
    kit: null,
    region: null,
    pack: null,
  })

  const byId = useMemo(() => {
    const map = new Map<string, LibraryExercise>()
    for (const exercise of library) map.set(exercise.id, exercise)
    return map
  }, [library])

  const catalogItems = useMemo(
    () => library.map((exercise) => libraryToCatalogItem(exercise)),
    [library],
  )
  const pickerItems = useMemo(() => {
    if (!homeOnly) return catalogItems
    return filterHomeExercises(
      catalogItems.filter(isHomeExercise),
      homeQuery,
    )
  }, [catalogItems, homeOnly, homeQuery])

  const { requestCloseDetails, requestCloseLibrary } = useOverlayHistory({
    onCloseDetails: () => {
      setDetailsId(null)
      setDetail(null)
      setDetailStatus('idle')
      setDetailsAdded(false)
    },
    onCloseLibrary: onClose,
  })

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (detailsId) requestCloseDetails()
      else requestCloseLibrary()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailsId, requestCloseDetails, requestCloseLibrary])

  useEffect(() => {
    if (!recentlyAddedId) return
    const timer = window.setTimeout(() => setRecentlyAddedId(null), 1800)
    return () => window.clearTimeout(timer)
  }, [recentlyAddedId])

  useEffect(() => {
    if (!detailsAdded) return
    const timer = window.setTimeout(() => setDetailsAdded(false), 1800)
    return () => window.clearTimeout(timer)
  }, [detailsAdded])

  useEffect(() => {
    if (!detailsId) {
      setDetail(null)
      setDetailStatus('idle')
      return
    }
    let cancelled = false
    setDetailStatus('loading')
    setDetail(null)
    setDetailsAdded(false)
    void loadExerciseDetail(detailsId, byId.get(detailsId)?.name)
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

  const addExercise = (exercise: LibraryExercise) => {
    onAdd(exercise)
    setLastAdded(exercise.id)
    setRecentlyAddedId(exercise.id)
    setLiveMessage(t('addedLive', { name: exercise.name, day: dayName }))
  }

  const handleAddFromList = (item: ExerciseCatalogItem) => {
    const exercise = (item.source as LibraryExercise | undefined) ?? byId.get(item.id)
    if (!exercise) return
    addExercise(exercise)
  }

  const handleAddFromDetails = () => {
    if (!detailsId) return
    const fromLibrary = byId.get(detailsId)
    if (fromLibrary) {
      addExercise(fromLibrary)
      setDetailsAdded(true)
      return
    }
    const fromPicker = pickerItems.find((item) => item.id === detailsId)
    if (fromPicker) {
      handleAddFromList(fromPicker)
      setDetailsAdded(true)
      return
    }
    setLiveMessage(tCatalog('loadError'))
  }

  const handleOpenDetails = (item: ExerciseCatalogItem) => {
    setDetailsId(item.id)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--overlay-scrim)] backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={() => {
        if (detailsId) requestCloseDetails()
        else requestCloseLibrary()
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={detailsId ? tCatalog('title') : t('libraryAria')}
        tabIndex={-1}
        className="relative flex h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-silver/15 bg-background shadow-2xl sm:h-[85svh] sm:rounded-3xl"
        initial={{ y: reduce ? 0 : 64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduce ? 0 : 64, opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>

        <div className="border-b border-silver/10 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.25em] text-gold">
                {t('libraryTitle')}
              </p>
              <h2 className="font-heading mt-0.5 text-lg font-bold text-foreground">
                {t('addingTo', { day: dayName })}
                <span className="ms-2 text-xs font-semibold text-muted-foreground">
                  {t('addedCount', { count: addedCount })}
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={requestCloseLibrary}
              aria-label={t('closeLibrary')}
              className="inline-flex size-11 items-center justify-center rounded-full border border-silver/20 text-muted-foreground transition-colors hover:border-silver/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5 ${
              detailsId ? 'pointer-events-none absolute inset-0 opacity-0' : ''
            }`}
            inert={Boolean(detailsId)}
            aria-hidden={Boolean(detailsId)}
          >
            <div className="mb-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => setHomeOnly(false)}
                aria-pressed={!homeOnly}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-3 text-xs font-bold tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                  !homeOnly
                    ? 'border-gold/60 bg-gold/15 text-gold'
                    : 'border-silver/15 bg-card/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tHome('catalogAll')}
              </button>
              <button
                type="button"
                onClick={() => setHomeOnly(true)}
                aria-pressed={homeOnly}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-3 text-xs font-bold tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                  homeOnly
                    ? 'border-gold/60 bg-gold/15 text-gold'
                    : 'border-silver/15 bg-card/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tHome('catalogHome')}
              </button>
            </div>
            {homeOnly ? (
              <div className="mb-3 shrink-0 overflow-x-auto pb-1">
                <HomeWorkoutFilters
                  query={homeQuery}
                  onChange={setHomeQuery}
                  compact
                />
              </div>
            ) : null}
            <ExercisePicker
              key={homeOnly ? 'home' : 'all'}
              items={pickerItems}
              value={lastAdded}
              recentlyAddedId={recentlyAddedId}
              onSelect={handleAddFromList}
              onAdd={handleAddFromList}
              onOpenDetails={handleOpenDetails}
              variant="list"
              homeMode={homeOnly}
              maxHeightClassName="min-h-[16rem] h-[min(40svh,24rem)] max-h-[min(40svh,24rem)]"
              listClassName=""
              className="flex min-h-[16rem] flex-1 flex-col"
            />
          </div>

          {detailsId ? (
            <div className="absolute inset-0 flex flex-col bg-background p-4 sm:p-5">
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
                    {tCatalog('closeDetails')}
                  </button>
                </div>
              ) : (
                <ExerciseDetailView
                  exercise={detail}
                  onBack={requestCloseDetails}
                  backLabel={tCatalog('backToLibrary')}
                  onAdd={handleAddFromDetails}
                  addLabel={tPicker('addToSplit')}
                  addedLabel={tPicker('added')}
                  added={detailsAdded}
                  addingTo={dayName}
                />
              )}
            </div>
          ) : null}
        </div>

        {!detailsId ? (
          <div className="border-t border-silver/10 p-4">
            <button
              type="button"
              onClick={requestCloseLibrary}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.01] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {t('doneBackTo', { day: dayName })}
            </button>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}
