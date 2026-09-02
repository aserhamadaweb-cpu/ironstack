'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExerciseDetailOverlay } from '@/components/exercise-detail-overlay'
import { ExercisePicker } from '@/components/exercise-picker'
import { libraryToCatalogItem } from '@/lib/exercise-catalog'
import type { LibraryExercise } from '@/lib/exercise-library'

type ExerciseBrowseClientProps = {
  library: LibraryExercise[]
}

export function ExerciseBrowseClient({ library }: ExerciseBrowseClientProps) {
  const t = useTranslations('exerciseCatalog')
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
