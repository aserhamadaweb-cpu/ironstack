'use client'

import { useState } from 'react'
import Image from 'next/image'

type HighlightShape = { cx: number; cy: number; rx: number; ry: number }

/**
 * Highlighted region per muscle group, drawn over a shared silhouette.
 * Coordinates map to the 48×52 viewBox below.
 */
const HIGHLIGHTS: Record<string, HighlightShape[]> = {
  Chest: [{ cx: 24, cy: 19, rx: 7, ry: 3.6 }],
  Back: [{ cx: 24, cy: 22, rx: 7.5, ry: 5.5 }],
  Shoulders: [
    { cx: 15.5, cy: 16.5, rx: 3, ry: 3 },
    { cx: 32.5, cy: 16.5, rx: 3, ry: 3 },
  ],
  Traps: [{ cx: 24, cy: 13.5, rx: 6.5, ry: 2.4 }],
  Neck: [{ cx: 24, cy: 12, rx: 3.4, ry: 2 }],
  Biceps: [
    { cx: 13, cy: 23, rx: 2.1, ry: 3.6 },
    { cx: 35, cy: 23, rx: 2.1, ry: 3.6 },
  ],
  Triceps: [
    { cx: 12.4, cy: 27.5, rx: 1.9, ry: 3.4 },
    { cx: 35.6, cy: 27.5, rx: 1.9, ry: 3.4 },
  ],
  Forearms: [
    { cx: 12, cy: 30.5, rx: 1.7, ry: 3 },
    { cx: 36, cy: 30.5, rx: 1.7, ry: 3 },
  ],
  Core: [{ cx: 24, cy: 26.5, rx: 4.6, ry: 4 }],
  Abs: [{ cx: 24, cy: 26.5, rx: 4.6, ry: 4 }],
  Glutes: [{ cx: 24, cy: 32.5, rx: 6, ry: 2.8 }],
  Abductors: [
    { cx: 18.6, cy: 35, rx: 2.2, ry: 3.4 },
    { cx: 29.4, cy: 35, rx: 2.2, ry: 3.4 },
  ],
  Adductors: [{ cx: 24, cy: 36.5, rx: 3, ry: 3.6 }],
  Quads: [
    { cx: 20.4, cy: 37.5, rx: 2.6, ry: 4.6 },
    { cx: 27.6, cy: 37.5, rx: 2.6, ry: 4.6 },
  ],
  Hamstrings: [
    { cx: 20.4, cy: 38.5, rx: 2.4, ry: 4 },
    { cx: 27.6, cy: 38.5, rx: 2.4, ry: 4 },
  ],
  Calves: [
    { cx: 20.6, cy: 44, rx: 2, ry: 3 },
    { cx: 27.4, cy: 44, rx: 2, ry: 3 },
  ],
}

function SilhouetteSvg({ muscle }: { muscle: string }) {
  const gradientId = `silver-${muscle.replace(/\s/g, '-')}`
  const shapes = HIGHLIGHTS[muscle] ?? HIGHLIGHTS.Core

  return (
    <svg viewBox="0 0 48 52" className="h-full w-full p-1.5" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6f7f9" />
          <stop offset="100%" stopColor="#8b8f97" />
        </linearGradient>
      </defs>

      <g fill="#5b5f66" opacity="0.55">
        <circle cx="24" cy="7" r="4" />
        <path d="M17 12h14l3 4v9l-2 8h-16l-2-8v-9z" />
        <path d="M14 16.5 11 20v11h3z" />
        <path d="M34 16.5 37 20v11h-3z" />
        <path d="M17 33h5v17h-5z" />
        <path d="M26 33h5v17h-5z" />
      </g>

      <g fill={`url(#${gradientId})`}>
        {shapes.map((shape, index) => (
          <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
        ))}
      </g>
    </svg>
  )
}

type ExerciseThumbProps = {
  /** Display muscle label (e.g. "Chest"); unknown labels fall back to torso. */
  muscle: string
  /** Real photo/illustration URL; falls back to the vector figure when absent or broken. */
  image?: string | null
  name: string
  className?: string
}

/**
 * Silver/white monochrome exercise thumbnail. Renders the supplied image, or a
 * simple anatomical silhouette with the target muscle group highlighted when
 * no image exists (or it fails to load).
 */
export function ExerciseThumb({ muscle, image, name, className }: ExerciseThumbProps) {
  const [broken, setBroken] = useState(false)
  const showImage = image && !broken

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-silver/15 bg-gradient-to-b from-zinc-800/80 to-zinc-950 ${
        className ?? 'size-12 sm:size-14'
      }`}
    >
      {showImage ? (
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover"
          sizes="112px"
          onError={() => setBroken(true)}
        />
      ) : (
        <SilhouetteSvg muscle={muscle} />
      )}
    </div>
  )
}
