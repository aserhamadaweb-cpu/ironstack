'use client'

import { useEffect, useRef, useState } from 'react'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { gifUrlFromImageUrl } from '@/lib/exercises/paths'
import { resolveExerciseMediaFromCache } from '@/lib/offline/prefetch-exercise-media'

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
  const catalogSrc = gif?.trim() || gifUrlFromImageUrl(image)
  const [displaySrc, setDisplaySrc] = useState<string | null>(catalogSrc)
  const [broken, setBroken] = useState(false)
  const blobRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }
    setBroken(false)
    setDisplaySrc(catalogSrc)

    async function applyCachedBlob() {
      if (!catalogSrc) return false
      const fromCache = await resolveExerciseMediaFromCache(catalogSrc)
      if (cancelled || !fromCache) return false
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
      blobRef.current = fromCache
      setDisplaySrc(fromCache)
      setBroken(false)
      return true
    }

    async function hydrate() {
      if (!catalogSrc) return
      const offline =
        typeof navigator !== 'undefined' && navigator.onLine === false
      if (offline) {
        await applyCachedBlob()
      }
    }

    void hydrate()

    return () => {
      cancelled = true
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
    }
  }, [catalogSrc])

  const showGif = Boolean(displaySrc) && !broken && !reduceMotion

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-silver/15 bg-background">
      {showGif && displaySrc ? (
        // Native img so the catalog GIF actually loops (next/image freezes GIFs).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={`${name} demonstration`}
          width={480}
          height={480}
          className="mx-auto aspect-square w-full max-h-[min(70vw,28rem)] object-contain"
          onError={() => {
            void (async () => {
              if (!catalogSrc || displaySrc.startsWith('blob:')) {
                setBroken(true)
                return
              }
              const fromCache = await resolveExerciseMediaFromCache(catalogSrc)
              if (fromCache) {
                if (blobRef.current) URL.revokeObjectURL(blobRef.current)
                blobRef.current = fromCache
                setDisplaySrc(fromCache)
                setBroken(false)
                return
              }
              setBroken(true)
            })()
          }}
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
