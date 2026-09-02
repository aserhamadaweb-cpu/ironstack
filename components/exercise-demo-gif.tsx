'use client'

import { useState } from 'react'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { gifUrlFromImageUrl } from '@/lib/exercises/paths'

type ExerciseDemoGifProps = {
  name: string
  muscle: string
  image?: string | null
  gif?: string | null
  reduceMotion?: boolean
}

export function ExerciseDemoGif({
  name,
  muscle,
  image,
  gif,
  reduceMotion = false,
}: ExerciseDemoGifProps) {
  const src = gif?.trim() || gifUrlFromImageUrl(image)
  const [broken, setBroken] = useState(false)
  const showGif = Boolean(src) && !broken && !reduceMotion

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-silver/15 bg-background">
      {showGif && src ? (
        // Native img so the catalog GIF actually loops (next/image freezes GIFs).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} demonstration`}
          width={480}
          height={480}
          className="mx-auto aspect-square w-full max-h-[min(70vw,28rem)] object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex justify-center py-4">
          <ExerciseThumb
            muscle={muscle}
            image={image}
            name={name}
            className="size-40 sm:size-52"
          />
        </div>
      )}
    </div>
  )
}
