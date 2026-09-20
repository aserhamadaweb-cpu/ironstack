'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CTA_PRIMARY } from '@/lib/accent'
import { formatClock } from '@/lib/session-store'
import type { ActiveWorkoutView } from '@/lib/active-workout'
import { useActiveWorkout } from '@/lib/use-active-workout'
import { useOfflineStatus } from '@/lib/offline/provider'
import { useEmbeddedSessionActive } from '@/lib/offline/embedded-session'

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

type ActiveWorkoutBannerProps = {
  /** Offline: resume without navigating to a server session route. */
  onResumeOffline?: (splitSlug: string) => void
}

export function ActiveWorkoutBanner({ onResumeOffline }: ActiveWorkoutBannerProps) {
  const { active } = useActiveWorkout()
  const embedded = useEmbeddedSessionActive()
  if (!active || embedded) return null
  return (
    <ActiveWorkoutCard workout={active} onResumeOffline={onResumeOffline} />
  )
}

export function ActiveWorkoutCard({
  workout,
  onResumeOffline,
}: {
  workout: ActiveWorkoutView
  onResumeOffline?: (splitSlug: string) => void
}) {
  const t = useTranslations('activeWorkout')
  const router = useRouter()
  const { online, hydrated } = useOfflineStatus()
  const elapsed = useElapsed(workout.startedAt)
  const offline = !hydrated || !online
  const progressLabel =
    workout.totalExercises > 0
      ? t('exerciseProgress', {
          current: Math.min(workout.exerciseIndex + 1, workout.totalExercises),
          total: workout.totalExercises,
        })
      : workout.setsLogged > 0
        ? t('setsLogged', { count: workout.setsLogged })
        : t('inProgress')

  const resumeClass = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold tracking-[0.14em] ${CTA_PRIMARY}`

  const resumeOfflineSafe = () => {
    if (onResumeOffline) {
      onResumeOffline(workout.splitId)
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      router.push(workout.href)
      return
    }
    // Offline without an embedded launcher — gym floor hosts Start/Resume.
    router.push('/dashboard/home')
  }

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
        {offline ? (
          <button type="button" onClick={resumeOfflineSafe} className={resumeClass}>
            <Play className="size-4 fill-current" aria-hidden="true" />
            {t('resume')}
          </button>
        ) : (
          <Link href={workout.href} className={resumeClass}>
            <Play className="size-4 fill-current" aria-hidden="true" />
            {t('resume')}
          </Link>
        )}
      </div>
    </section>
  )
}
