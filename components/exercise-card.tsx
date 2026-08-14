'use client'

import type { ReactNode } from 'react'
import { ExerciseThumb } from '@/components/exercise-thumb'

type ExerciseCardProps = {
  /** Zero-based position; rendered as a two-digit number. */
  index: number
  name: string
  /** Muscle keys used for the thumbnail silhouette (e.g. "Chest"). */
  muscles: string[]
  /** Optional display labels for muscle pills (e.g. Arabic). Defaults to `muscles`. */
  displayMuscles?: string[]
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
  displayMuscles,
  image,
  setsReps,
  leading,
  trailing,
  children,
}: ExerciseCardProps) {
  const primaryMuscle = muscles[0] ?? 'Core'
  const labels = displayMuscles ?? muscles
  const primaryLabel = labels[0] ?? primaryMuscle
  const readOnly = setsReps != null

  return (
    <>
      <div className="flex items-center gap-3 sm:gap-4">
        {leading}

        <ExerciseThumb muscle={primaryMuscle} image={image} name={name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="truncate font-heading text-base font-semibold text-foreground sm:text-lg">
              {name}
            </h3>
          </div>

          {readOnly ? (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{setsReps}</p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {labels.map((label, i) => (
                <span
                  key={`${muscles[i] ?? label}-${i}`}
                  className="rounded-full border border-silver/20 bg-background/60 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {readOnly && (
          <span className="hidden shrink-0 rounded-full border border-silver/20 bg-background/60 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground sm:inline-block">
            {primaryLabel}
          </span>
        )}

        {trailing}
      </div>

      {children}
    </>
  )
}
