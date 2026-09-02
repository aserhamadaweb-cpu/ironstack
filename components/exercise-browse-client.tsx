'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ExercisePicker } from '@/components/exercise-picker'
import { libraryToCatalogItem } from '@/lib/exercise-catalog'
import type { LibraryExercise } from '@/lib/exercise-library'

type ExerciseBrowseClientProps = {
  library: LibraryExercise[]
}

export function ExerciseBrowseClient({ library }: ExerciseBrowseClientProps) {
  const router = useRouter()
  const items = useMemo(
    () => library.map((exercise) => libraryToCatalogItem(exercise)),
    [library],
  )

  return (
    <ExercisePicker
      items={items}
      variant="list"
      maxHeightClassName="max-h-[min(70vh,44rem)]"
      className="flex min-h-0 flex-1 flex-col"
      onSelect={(item) => {
        if (item.detailsHref) {
          const href = item.detailsHref.includes('?')
            ? `${item.detailsHref}&from=${encodeURIComponent('/dashboard/exercises')}`
            : `${item.detailsHref}?from=${encodeURIComponent('/dashboard/exercises')}`
          router.push(href)
        }
      }}
    />
  )
}
