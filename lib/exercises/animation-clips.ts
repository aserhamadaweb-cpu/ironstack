import type { Exercise } from '@/lib/exercises/types'

/**
 * GIF clips replaced the previous 3D placeholder. Each exercise resolves to
 * its dataset GIF via media_id + source id — never a shared/placeholder clip.
 */
export function animationGifFor(exercise: Exercise): string {
  return exercise.gifUrl
}

export function thumbnailFor(exercise: Exercise): string {
  return exercise.image
}
