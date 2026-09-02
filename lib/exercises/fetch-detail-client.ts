'use client'

import type { ExerciseDetailDto } from '@/lib/exercises/actions'
import { padCatalogId, isDbUuid } from '@/lib/exercises/detail-id'
import { loadExerciseDetailOffline } from '@/lib/exercises/fetch-detail-offline'

/**
 * Load exercise detail via same-origin GET — reliable on mobile/PWA where
 * server actions or full page navigations can fail on slow networks.
 */
export async function loadExerciseDetail(
  id: string,
  name?: string,
): Promise<ExerciseDetailDto | null> {
  const idTrim = id.trim()
  const nameTrim = name?.trim()
  const lookupId = (() => {
    if (isDbUuid(idTrim)) return nameTrim ?? idTrim
    return padCatalogId(idTrim)
  })()

  const params = new URLSearchParams()
  if (nameTrim) params.set('name', nameTrim)
  const qs = params.toString()
  const url = `/api/exercises/${encodeURIComponent(lookupId)}${qs ? `?${qs}` : ''}`

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (response.ok) {
      return (await response.json()) as ExerciseDetailDto
    }
  } catch {
    /* fall through to offline bundle */
  }

  return loadExerciseDetailOffline(lookupId, nameTrim ?? idTrim)
}
