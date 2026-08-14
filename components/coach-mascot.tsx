'use client'

import { motion, useReducedMotion } from 'framer-motion'

type CoachMascotProps = {
  className?: string
  /** Large empty-state only — subtle float/breath idle. */
  idle?: boolean
  title?: string
}

/**
 * Flat geometric IronStack Coach mascot — double-bicep flex robot.
 * Colors use theme CSS variables so light/dark both read cleanly.
 */
export function CoachMascot({
  className = 'size-8',
  idle = false,
  title = 'IronStack Coach',
}: CoachMascotProps) {
  const reduce = useReducedMotion()
  const animateIdle = idle && !reduce

  const plate = 'var(--muted)'
  const plateDeep = 'var(--card)'
  const plateEdge = 'var(--border)'
  const accent = 'var(--blue)'
  const gold = 'var(--gold)'
  const success = 'var(--success)'
  const visorBg = 'color-mix(in srgb, var(--gold) 18%, var(--card))'
  const visorShine = 'color-mix(in srgb, var(--gold) 55%, white)'

  const svg = (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      <rect
        x="10"
        y="22"
        width="18"
        height="16"
        rx="5"
        fill={plate}
        stroke={accent}
        strokeWidth="1.6"
      />
      <circle cx="15" cy="30" r="1.8" fill={accent} />
      <circle cx="23" cy="30" r="1.8" fill={accent} />

      <path
        d="M19 38v18c0 3 2 5 5 5h4c2 0 3-2 3-4V42c0-3-2-5-5-5H22c-1.5 0-3 1-3 1z"
        fill={plateDeep}
        stroke={plateEdge}
        strokeWidth="1.2"
      />

      <ellipse
        cx="28"
        cy="58"
        rx="14"
        ry="12"
        fill={plate}
        stroke={plateDeep}
        strokeWidth="1.4"
      />
      <ellipse cx="28" cy="58" rx="8" ry="7" fill={plateDeep} />

      <rect
        x="100"
        y="22"
        width="18"
        height="16"
        rx="5"
        fill={plate}
        stroke={accent}
        strokeWidth="1.6"
      />
      <circle cx="105" cy="30" r="1.8" fill={accent} />
      <circle cx="113" cy="30" r="1.8" fill={accent} />

      <path
        d="M109 38v18c0 3-2 5-5 5h-4c-2 0-3-2-3-4V42c0-3 2-5 5-5h4c1.5 0 3 1 3 1z"
        fill={plateDeep}
        stroke={plateEdge}
        strokeWidth="1.2"
      />

      <ellipse
        cx="100"
        cy="58"
        rx="14"
        ry="12"
        fill={plate}
        stroke={plateDeep}
        strokeWidth="1.4"
      />
      <ellipse cx="100" cy="58" rx="8" ry="7" fill={plateDeep} />

      <path
        d="M30 52c4-10 16-16 34-16s30 6 34 16c2 5-2 10-10 12H40c-8-2-12-7-10-12z"
        fill={plate}
        stroke={plateDeep}
        strokeWidth="1.6"
      />
      <path d="M40 62h48" stroke={gold} strokeWidth="1.3" opacity="0.6" />

      <path
        d="M40 62h48l-7 40H47L40 62z"
        fill={plateDeep}
        stroke={plate}
        strokeWidth="1.8"
      />
      <path d="M46 68h36l-5 28H51L46 68z" fill={plate} opacity="0.5" />

      <path d="M66 72l-7 11h6l-4 12 12-14h-6l5-9H66z" fill={gold} />

      <circle cx="80" cy="76" r="2.6" fill={success} />
      <circle cx="80" cy="76" r="1.2" fill={visorShine} />

      <rect
        x="44"
        y="14"
        width="40"
        height="32"
        rx="10"
        fill={plateDeep}
        stroke={plate}
        strokeWidth="2"
      />
      <rect x="48" y="18" width="32" height="7" rx="2" fill={plate} />

      <rect x="50" y="30" width="28" height="9" rx="3.5" fill={visorBg} />
      <rect x="52" y="31.5" width="24" height="6" rx="2.5" fill={gold} />
      <rect
        x="54"
        y="32.5"
        width="10"
        height="2.2"
        rx="1"
        fill={visorShine}
        opacity="0.9"
      />

      <rect x="56" y="44" width="16" height="10" rx="2" fill={plate} />
      <circle cx="64" cy="49" r="1.6" fill={gold} />

      <path
        d="M48 100h32l-4 10H52L48 100z"
        fill={plateDeep}
        stroke={plate}
        strokeWidth="1.2"
      />
    </svg>
  )

  if (!animateIdle) return svg

  return (
    <motion.div
      className="inline-flex"
      animate={{ y: [0, -6, 0], scale: [1, 1.02, 1] }}
      transition={{
        duration: 3.6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {svg}
    </motion.div>
  )
}
