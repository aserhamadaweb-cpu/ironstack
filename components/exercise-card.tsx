'use client'

import type { ReactNode } from 'react'
import { ExerciseThumb } from '@/components/exercise-thumb'

type ExerciseCardProps = {
  /** Zero-based position; rendered as a two-digit number. */
  index: number
  name: string
  /** Display muscle labels; the first is used for the thumbnail + read-only pill. */
  muscles: string[]
  /** Real photo URL (shared exercise-image dataset); falls back to a silhouette. */
  image?: string | null
  /**
   * When provided, the card renders in read-only mode: a static line such as
   * "4 sets × 5 reps" under the name and a single muscle pill on the right.
   * Omit it for the interactive builder, which shows muscle pills instead.
   */
  setsReps?: string
  /** Optional leading control (e.g. a drag handle) — builder only. */
  leading?: ReactNode
  /** Optional trailing control (e.g. a delete button) — builder only. */
  trailing?: ReactNode
  /** Optional controls rendered below the header (sets stepper, set-type toggle) — builder only. */
  children?: ReactNode
}

/**
 * Shared exercise card used by both the "Create Your Own Split" builder and the
 * ready-made split detail pages, so the photo thumbnail, numbering, name and
 * muscle typography stay identical across the app. Pass `setsReps` for the
 * read-only variant; pass `leading`/`trailing`/`children` for the editable one.
 */
export function ExerciseCard({
  index,
  name,
  muscles,
  image,
  setsReps,
  leading,
  trailing,
  children,
}: ExerciseCardProps) {
  const primaryMuscle = muscles[0] ?? 'Core'
  const readOnly = setsReps != null

  return (
    <>
      <div className="flex items-center gap-3 sm:gap-4">
        {leading}

        <ExerciseThumb muscle={primaryMuscle} image={image} name={name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold tabular-nums text-zinc-600">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="truncate font-heading text-base font-semibold text-white sm:text-lg">
              {name}
            </h3>
          </div>

          {readOnly ? (
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">{setsReps}</p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {muscles.map((muscle) => (
                <span
                  key={muscle}
                  className="rounded-full border border-silver/20 bg-zinc-950/60 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-zinc-400"
                >
                  {muscle.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        {readOnly && (
          <span className="hidden shrink-0 rounded-full border border-silver/20 bg-zinc-950/60 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-400 sm:inline-block">
            {primaryMuscle.toUpperCase()}
          </span>
        )}

        {trailing}
      </div>

      {children}
    </>
  )
}
