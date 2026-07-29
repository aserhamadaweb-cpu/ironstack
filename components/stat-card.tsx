'use client'

import type { ComponentType } from 'react'
import { motion, type Variants } from 'framer-motion'
import { CountUp } from '@/components/count-up'

export type StatCardData = {
  label: string
  value: number
  suffix?: string
  icon: ComponentType<{ className?: string }>
  accent: string
  /** Show an em dash instead of counting up (e.g. no data yet). */
  empty?: boolean
}

export function StatCard({
  stat,
  variants,
}: {
  stat: StatCardData
  variants?: Variants
}) {
  return (
    <motion.article
      variants={variants}
      className="glass-card rounded-2xl border border-silver/10 p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
            {stat.label.toUpperCase()}
          </p>
          <p className="mt-2 font-heading text-2xl font-bold tabular-nums text-foreground">
            {stat.empty ? (
              '—'
            ) : (
              <CountUp
                value={stat.value}
                formatter={(n) => `${n}${stat.suffix ?? ''}`}
              />
            )}
          </p>
        </div>
        <div
          className={`flex size-10 items-center justify-center rounded-xl border border-silver/15 bg-background/40 ${stat.accent}`}
        >
          <stat.icon className="size-4" aria-hidden="true" />
        </div>
      </div>
    </motion.article>
  )
}
