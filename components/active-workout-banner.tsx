'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CTA_PRIMARY } from '@/lib/accent'
import { formatClock } from '@/lib/session-store'
import type { ActiveWorkoutView } from '@/lib/active-workout'
import { useActiveWorkout } from '@/lib/use-active-workout'

function useElapsed(startedAt: string) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
  )
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(
        Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])
  return elapsed
}

export function ActiveWorkoutBanner() {
  const { active } = useActiveWorkout()
  if (!active) return null
  return <ActiveWorkoutCard workout={active} />
}

export function ActiveWorkoutCard({ workout }: { workout: ActiveWorkoutView }) {
  const t = useTranslations('activeWorkout')
  const elapsed = useElapsed(workout.startedAt)
  const progressLabel =
    workout.totalExercises > 0
      ? t('exerciseProgress', {
          current: Math.min(workout.exerciseIndex + 1, workout.totalExercises),
          total: workout.totalExercises,
        })
      : workout.setsLogged > 0
        ? t('setsLogged', { count: workout.setsLogged })
        : t('inProgress')

  return (
    <section
      data-tour="home-active-banner"
      className="is-panel mb-8 overflow-hidden border-gold/30 p-5 sm:mb-10 sm:p-6"
      aria-label={t('title')}
    >
      <p className="section-kicker text-gold">{t('kicker')}</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
            {t('title')}
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {workout.splitName}
            {workout.dayName ? ` · ${workout.dayName}` : ''}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {t('elapsed', { time: formatClock(elapsed) })} · {progressLabel}
          </p>
        </div>
        <Link
          href={workout.href}
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
          {t('resume')}
        </Link>
      </div>
    </section>
  )
}
