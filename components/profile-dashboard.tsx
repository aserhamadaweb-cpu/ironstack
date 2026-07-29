'use client'

import { Activity, Flame, Target, Trophy } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { AiCoachPanel } from '@/components/ai-coach-panel'
import { DashboardNav } from '@/components/dashboard-nav'
import { FloatingActions } from '@/components/floating-actions'
import { MonthHeatmap } from '@/components/month-heatmap'
import { RoutePreloader } from '@/components/route-preloader'
import { EASE } from '@/components/reveal'
import { StatCard, type StatCardData } from '@/components/stat-card'
import { PersonalPrBoard } from '@/components/training-circle-feed'
import { getTrainingStats, initialsFrom } from '@/lib/dashboard-utils'

type ProfileDashboardProps = {
  displayName: string
  email: string
}

export function ProfileDashboard({ displayName, email }: ProfileDashboardProps) {
  const reduce = useReducedMotion()
  const stats = getTrainingStats()

  const statCards: StatCardData[] = [
    { label: 'Active PRs', value: stats.activePrs, icon: Target, accent: 'text-gold' },
    { label: 'Total Logs', value: stats.totalLogs, icon: Activity, accent: 'text-silver' },
    {
      label: 'Heaviest Lift',
      value: stats.heaviest,
      suffix: ' kg',
      icon: Flame,
      accent: 'text-success',
      empty: stats.heaviest === 0,
    },
    { label: 'This Month', value: stats.thisMonth, icon: Trophy, accent: 'text-silver' },
  ]

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  }

  return (
    <div className="min-h-svh pb-20 md:pb-0">
      <RoutePreloader />

      <DashboardNav userName={displayName} initials={initialsFrom(displayName)} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
        <motion.div
          className="mb-8 flex flex-col gap-2 sm:mb-10"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
            PROFILE
          </p>
          <h1 className="font-heading text-metallic text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Your Profile
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A quick look at who you are and how training&apos;s going — including
            your month-long flame map and personal records.
          </p>
        </motion.div>

        <motion.section
          className="flex flex-col gap-6"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.article
            variants={item}
            className="glass-card sheen-border flex flex-col items-center gap-4 rounded-2xl p-6 text-center sm:flex-row sm:p-8 sm:text-left"
          >
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full border chip-amber text-2xl font-bold">
              {initialsFrom(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-2xl font-bold text-foreground">
                {displayName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </motion.article>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {statCards.map((stat) => (
              <StatCard key={stat.label} stat={stat} variants={item} />
            ))}
          </div>

          <motion.div variants={item}>
            <MonthHeatmap />
          </motion.div>

          <motion.div variants={item}>
            <PersonalPrBoard />
          </motion.div>

          <motion.div variants={item}>
            <AiCoachPanel athleteName={displayName} />
          </motion.div>
        </motion.section>
      </main>

      <FloatingActions />
    </div>
  )
}
