'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE } from '@/components/reveal'

type FeaturePlaceholderProps = {
  eyebrow: string
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  accent?: 'gold' | 'primary' | 'silver'
}

const accentMap = {
  gold: 'border chip-amber',
  primary: 'border chip-blue',
  silver: 'border chip-green',
} as const

export function FeaturePlaceholder({
  eyebrow,
  title,
  description,
  icon: Icon,
  accent = 'gold',
}: FeaturePlaceholderProps) {
  const reduce = useReducedMotion()

  return (
    <div className="min-h-svh">


      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center md:py-32">
        <motion.div
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <span
            className={`flex size-16 items-center justify-center rounded-2xl border ${accentMap[accent]}`}
          >
            <Icon className="size-8" />
          </span>
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {eyebrow}
          </p>
          <h1 className="font-heading text-metallic text-4xl font-bold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <span className="rounded-full border border-silver/20 px-4 py-1.5 text-[10px] font-semibold tracking-[0.25em] text-silver-dim">
            COMING SOON
          </span>
          <Link
            href="/dashboard/workout"
            className="mt-2 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            BACK TO WORKOUT
          </Link>
        </motion.div>
      </main>
    </div>
  )
}
