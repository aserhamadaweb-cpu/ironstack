'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExerciseDetailOverlay } from '@/components/exercise-detail-overlay'
import { ExercisePicker } from '@/components/exercise-picker'
import { libraryToCatalogItem } from '@/lib/exercise-catalog'
import { useClientExerciseLibrary } from '@/lib/use-client-exercise-library'

export function ExerciseBrowseClient() {
  const t = useTranslations('exerciseCatalog')
  const { library, loading, error } = useClientExerciseLibrary()
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detailsName, setDetailsName] = useState<string | undefined>(undefined)
  const items = useMemo(
    () => library.map((exercise) => libraryToCatalogItem(exercise)),
    [library],
  )

  const closeDetails = useCallback(() => {
    setDetailsId(null)
    setDetailsName(undefined)
  }, [])

  const openDetails = useCallback((id: string, name: string) => {
    setDetailsId(id)
    setDetailsName(name)
  }, [])

  if (loading) {
    return (
      <div
        className="flex min-h-[16rem] flex-1 items-center justify-center rounded-xl border border-dashed border-silver/20 bg-card/30"
        role="status"
        aria-label={t('loading')}
      >
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  if (error || items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-silver/20 px-4 py-12 text-center text-sm text-muted-foreground">
        {t('loadError')}
      </p>
    )
  }

  return (
    <>
      <ExercisePicker
        items={items}
        variant="list"
        maxHeightClassName="max-h-[min(70vh,44rem)]"
        className="flex min-h-0 flex-1 flex-col"
        onSelect={(item) => openDetails(item.id, item.name)}
      />
      {detailsId ? (
        <ExerciseDetailOverlay
          exerciseId={detailsId}
          exerciseName={detailsName}
          onClose={closeDetails}
          backLabel={t('backToCatalog')}
        />
      ) : null}
    </>
  )
}
