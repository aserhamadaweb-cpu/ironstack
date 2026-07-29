'use client'

import { BrainCircuit, ClipboardList, Users } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { EASE, Reveal } from '@/components/reveal'
import { ACCENT } from '@/lib/accent'

const features = [
  {
    id: 'ai-assistant',
    icon: BrainCircuit,
    title: 'AI Assistant',
    description:
      'Your personal training buddy. Get workout plans that fit your life, friendly recovery tips, and helpful advice whenever you need it.',
    tone: 'amber' as const,
  },
  {
    id: 'lift-tracker',
    icon: ClipboardList,
    title: 'Lift Tracker',
    description:
      'Log every set, watch your working weights climb, and turn consistent effort into real, visible progress.',
    tone: 'blue' as const,
  },
  {
    id: 'community-circle',
    icon: Users,
    title: 'Community Circle',
    description:
      'A warm and welcoming space to share your journey. Cheer each other on, swap tips, and make friends who love training as much as you do.',
    tone: 'green' as const,
  },
]

export function FeatureGrid() {
  const reduce = useReducedMotion()

  const gridVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.14 },
    },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE },
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
            EVERYTHING YOU NEED TO GROW
          </h2>
        </Reveal>
      </div>

      <motion.div
        className="grid gap-6 md:grid-cols-3"
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
            whileHover={reduce ? undefined : { y: -6, scale: 1.02 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="glass-card sheen-border group flex flex-col gap-5 rounded-2xl p-8"
          >
            <div
              className={`icon-bounce flex size-12 items-center justify-center rounded-xl transition-colors duration-300 ${ACCENT[feature.tone].chip}`}
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
