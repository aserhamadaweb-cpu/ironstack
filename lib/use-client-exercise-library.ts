'use client'

import { useEffect, useState } from 'react'
import type { LibraryExercise } from '@/lib/exercise-library'
import { loadExerciseLibraryOffline } from '@/lib/exercise-library.client'

/** Load the exercise catalog from IndexedDB / offline JSON — avoids huge RSC payloads. */
export function useClientExerciseLibrary() {
  const [library, setLibrary] = useState<LibraryExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadExerciseLibraryOffline()
      .then((rows) => {
        if (!cancelled) setLibrary(rows)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { library, loading, error, count: library.length }
}
