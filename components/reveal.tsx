'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Shared premium easing — snappy ease-out curve used across the site.
export const EASE = [0.22, 1, 0.36, 1] as const

type RevealProps = {
  children: ReactNode
  className?: string
  /** Delay in seconds before the reveal starts. */
  delay?: number
  /** Vertical offset (px) the element rises from. */
  y?: number
}

/**
 * Fades + slides its children into view once, driven by an IntersectionObserver
 * (via Framer Motion's `whileInView`). Respects prefers-reduced-motion.
 */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
