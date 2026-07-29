'use client'

import { motion } from 'framer-motion'
import { EASE } from '@/components/reveal'

// Deterministic particle layout (no randomness → no hydration mismatch).
const PARTICLES = [
  { left: '16%', top: '28%', size: 3, delay: 0.2 },
  { left: '26%', top: '64%', size: 2, delay: 0.7 },
  { left: '36%', top: '20%', size: 2, delay: 1.1 },
  { left: '46%', top: '76%', size: 2, delay: 0.4 },
  { left: '58%', top: '16%', size: 2, delay: 0.9 },
  { left: '66%', top: '68%', size: 3, delay: 0.5 },
  { left: '76%', top: '30%', size: 2, delay: 1.3 },
  { left: '84%', top: '56%', size: 3, delay: 0.3 },
]

/**
 * Full-screen gym-themed intro. Two dumbbell halves slam together with a
 * weighty spring, an impact ring fires, and the wordmark rises in — all on
 * the same black + gold glow backdrop as the dashboard behind it.
 */
export function HubPreloader() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-background"
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 0.55, ease: EASE }}
      aria-label="Loading your hub"
      role="status"
    >
      {/* Same backdrop treatment as the dashboard for a continuous feel */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(234,179,8,0.14),transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(214,214,224,0.05)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,black,transparent_75%)]"
        aria-hidden="true"
      />

      {/* Floating particles */}
      {PARTICLES.map((particle, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-gold/70"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
          }}
          animate={{ opacity: [0, 0.9, 0], y: [6, -10] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
          aria-hidden="true"
        />
      ))}

      {/* Breathing glow behind the dumbbell */}
      <motion.div
        className="absolute size-72 rounded-full bg-gold/10 blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.95, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />

      {/* Impact ring — fires right as the plates meet */}
      <motion.div
        className="absolute rounded-full border border-gold/60"
        initial={{ width: 90, height: 90, opacity: 0 }}
        animate={{ width: 260, height: 260, opacity: [0, 0.55, 0] }}
        transition={{ delay: 0.62, duration: 0.7, ease: 'easeOut' }}
        aria-hidden="true"
      />

      {/* Dumbbell: bar stretches in, plate stacks slam in from both sides */}
      <motion.div
        className="relative z-10 flex items-center"
        animate={{ x: [0, 0, -3, 3, -1, 0] }}
        transition={{ delay: 0.58, duration: 0.32 }}
        aria-hidden="true"
      >
        <motion.div
          className="flex items-center gap-1"
          initial={{ x: -120, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.15 }}
        >
          <div className="h-9 w-2.5 rounded-md bg-gold/45" />
          <div className="h-12 w-3 rounded-md bg-gold/70" />
          <div className="h-16 w-3.5 rounded-md bg-gold" />
        </motion.div>

        <motion.div
          className="mx-1 h-2.5 w-28 origin-center rounded-full bg-gradient-to-r from-silver-dim via-silver to-silver-dim"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
        />

        <motion.div
          className="flex items-center gap-1"
          initial={{ x: 120, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.15 }}
        >
          <div className="h-16 w-3.5 rounded-md bg-gold" />
          <div className="h-12 w-3 rounded-md bg-gold/70" />
          <div className="h-9 w-2.5 rounded-md bg-gold/45" />
        </motion.div>
      </motion.div>

      {/* Wordmark */}
      <motion.p
        className="font-heading text-metallic z-10 mt-10 text-2xl font-bold tracking-[0.3em]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.5, ease: EASE }}
      >
        IRONSTACK
      </motion.p>
      <motion.p
        className="z-10 mt-3 text-[10px] font-semibold tracking-[0.4em] text-gold"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.55, 1] }}
        transition={{ delay: 1.1, duration: 1, ease: 'easeInOut' }}
      >
        POWERED BY ASER HAMADA
      </motion.p>
    </motion.div>
  )
}
