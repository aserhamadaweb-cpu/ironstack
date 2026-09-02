'use client'

import type { ExerciseDetailDto } from '@/lib/exercises/actions'

/**
 * Load exercise detail via same-origin GET — reliable on mobile/PWA where
 * server actions or full page navigations can fail on slow networks.
 */
export async function loadExerciseDetail(
  id: string,
  name?: string,
): Promise<ExerciseDetailDto | null> {
  const params = new URLSearchParams()
  if (name?.trim()) params.set('name', name.trim())
  const qs = params.toString()
  const url = `/api/exercises/${encodeURIComponent(id.trim())}${qs ? `?${qs}` : ''}`

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'force-cache',
    })
    if (!response.ok) return null
    return (await response.json()) as ExerciseDetailDto
  } catch {
    return null
  }
}
