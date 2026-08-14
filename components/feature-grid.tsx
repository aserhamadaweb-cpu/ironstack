'use client'

import {
  BrainCircuit,
  ClipboardList,
  History,
  MessageSquare,
  Swords,
  Trophy,
} from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { EASE, Reveal } from '@/components/reveal'
import { ACCENT } from '@/lib/accent'

const features = [
  {
    id: 'training',
    icon: ClipboardList,
    title: 'Workout logging',
    description:
      'Run your splits, log sets and cardio, and keep every session on record.',
    tone: 'blue' as const,
  },
  {
    id: 'messages',
    icon: MessageSquare,
    title: 'Messages & groups',
    description:
      'DMs and group chats so your training circle stays close between sessions.',
    tone: 'green' as const,
  },
  {
    id: 'challenges',
    icon: Swords,
    title: 'Friend challenges',
    description:
      'Pick a lift, set a target, and settle it under the bar with a friend.',
    tone: 'amber' as const,
  },
  {
    id: 'progress',
    icon: Trophy,
    title: 'PRs & streaks',
    description:
      'Personal records, leaderboards, and streak tracking that reward consistency.',
    tone: 'amber' as const,
  },
  {
    id: 'history',
    icon: History,
    title: 'Training history',
    description:
      'Browse past sessions and volume so you can see the climb, not just today.',
    tone: 'blue' as const,
  },
  {
    id: 'ai-coach',
    icon: BrainCircuit,
    title: 'AI Coach',
    description:
      'Coaching tips grounded in your own logs, recovery, and training pattern.',
    tone: 'green' as const,
  },
]

export function FeatureGrid() {
  const reduce = useReducedMotion()

  const gridVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.1 },
    },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE },
    },
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-16 flex flex-col items-center gap-4 text-center">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.4em] text-gold">
            WHAT YOU GET
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-heading text-metallic text-balance text-3xl font-bold md:text-5xl">
            EVERYTHING IN THE APP
          </h2>
        </Reveal>
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={gridVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {features.map((feature) => (
          <motion.article
            key={feature.id}
            id={feature.id}
            variants={cardVariants}
            className="glass-card sheen-border flex flex-col gap-4 rounded-2xl p-6 transition-transform duration-200 active:scale-[0.98]"
          >
            <div
              className={`flex size-12 items-center justify-center rounded-xl ${ACCENT[feature.tone].chip}`}
            >
              <feature.icon className="size-6" aria-hidden="true" />
            </div>
            <h3 className="font-heading text-xl font-semibold text-foreground">
              {feature.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}
