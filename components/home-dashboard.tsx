'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Activity,
  BrainCircuit,
  ClipboardList,
  Dumbbell,
  Target,
  Users,
} from 'lucide-react'
import { AiCoachPanel } from '@/components/ai-coach-panel'
import { DashboardNav } from '@/components/dashboard-nav'
import { FloatingActions } from '@/components/floating-actions'
import { RealisticFire } from '@/components/realistic-fire'
import { RoutePreloader } from '@/components/route-preloader'
import { StreakFlame } from '@/components/streak-flame'
import { TrainingCircleFeed } from '@/components/training-circle-feed'
import { ACCENT, CTA_PRIMARY, toneAt } from '@/lib/accent'
import { initialsFrom } from '@/lib/dashboard-utils'
import {
  formatSessionDate,
  isSameLocalDay,
  loadSessions,
  type LoggedSession,
} from '@/lib/session-store'

type HomeDashboardProps = {
  displayName: string
  email: string
  username?: string
}

const WHY_IRONSTACK = [
  {
    icon: BrainCircuit,
    title: 'AI-Powered Coaching',
    description: 'Personalized cues and plans that adapt as you get stronger.',
  },
  {
    icon: ClipboardList,
    title: 'Progress Tracking',
    description: 'Log every set and watch your numbers climb over time.',
  },
  {
    icon: Users,
    title: 'Community Support',
    description: 'Train alongside lifters who celebrate the same wins you do.',
  },
  {
    icon: Target,
    title: 'Personalized Programs',
    description: 'Programs shaped around your level, goals, and schedule.',
  },
]

const WEEK_ACTIVITY = [
  { day: 'Mon', done: true },
  { day: 'Tue', done: true },
  { day: 'Wed', done: false },
  { day: 'Thu', done: true },
  { day: 'Fri', done: true },
  { day: 'Sat', done: false },
  { day: 'Sun', done: false },
]

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.89 3l-.2.37a18.3 18.3 0 0 1 4.5 2.16 15.5 15.5 0 0 0-14.38 0A18.3 18.3 0 0 1 10.3 3.37 19.7 19.7 0 0 0 5.9 4.38C2.57 9.27 1.71 14.03 2.1 18.73a19.9 19.9 0 0 0 5.98 3.01l.8-1.35a12.9 12.9 0 0 1-1.9-.92l.46-.36c3.65 1.7 7.61 1.7 11.22 0l.46.36c-.61.36-1.25.66-1.91.92l.8 1.35a19.9 19.9 0 0 0 5.98-3.01c.46-5.45-.78-10.17-3.67-14.36ZM8.7 15.6c-1.1 0-2-.98-2-2.18s.88-2.18 2-2.18 2.02 1 2 2.18-.88 2.18-2 2.18Zm6.6 0c-1.1 0-2-.98-2-2.18s.88-2.18 2-2.18 2.02 1 2 2.18-.9 2.18-2 2.18Z" />
    </svg>
  )
}

export function HomeDashboard({
  displayName,
  email,
  username,
}: HomeDashboardProps) {
  const handle =
    username ||
    displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
    'athlete'
  const firstName = displayName.trim().split(/\s+/)[0] || displayName

  // Sessions saved from the Active Session flow (localStorage).
  const [logged, setLogged] = useState<LoggedSession[]>([])
  useEffect(() => {
    setLogged(loadSessions())
  }, [])

  /** This week's tiles: demo pattern OR a real logged session on that day. */
  const weekActivity = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    return WEEK_ACTIVITY.map((mockDay, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const trained = logged.some((session) =>
        isSameLocalDay(new Date(session.startedAt), date)
      )
      return { day: mockDay.day, done: mockDay.done || trained }
    })
  }, [logged])

  const weekSessionCount = weekActivity.filter((day) => day.done).length

  /** Caption under the streak grid: heaviest lift of the latest real session. */
  const lastSessionCaption = useMemo(() => {
    const latest = logged.length > 0 ? logged[logged.length - 1] : null
    if (!latest) return 'Last session: Deadlift · 220 kg × 1 · Jul 12'

    let heaviest: { name: string; weight: number; reps: number } | null = null
    for (const exercise of latest.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed || set.weight <= 0) continue
        if (!heaviest || set.weight > heaviest.weight) {
          heaviest = { name: exercise.name, weight: set.weight, reps: set.reps }
        }
      }
    }
    const date = formatSessionDate(latest.startedAt)
    return heaviest
      ? `Last session: ${heaviest.name} · ${heaviest.weight} kg × ${heaviest.reps} · ${date}`
      : `Last session: ${latest.dayFocus} · ${latest.splitName} · ${date}`
  }, [logged])

  return (
    <div className="relative min-h-svh overflow-x-clip pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[70svh] [mask-image:linear-gradient(to_bottom,black_15%,transparent)]">
          <Image
            src="/images/hero-gym.png"
            alt=""
            fill
            className="object-cover opacity-[0.18]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/55 to-background" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(234,179,8,0.14),transparent_60%)]" />
        <div className="absolute top-[40%] -left-32 h-80 w-80 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute right-[-6rem] bottom-20 h-96 w-96 rounded-full bg-primary/[0.1] blur-3xl" />
        <div className="absolute top-[18%] right-[20%] h-48 w-48 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <RoutePreloader />

      <DashboardNav userName={displayName} initials={initialsFrom(displayName)} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-card p-5 sm:mb-10 sm:p-8 md:p-10">
          <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
          <Dumbbell
            className="absolute -right-8 -bottom-10 size-56 -rotate-12 text-gold opacity-[0.07]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold-tint text-xl font-bold text-gold sm:size-24 sm:text-3xl">
                {initialsFrom(displayName)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
                  WELCOME HOME
                </p>
                <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Hey, {firstName}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  @{handle}
                  <span className="mx-2 text-zinc-600">·</span>
                  <span className="hidden sm:inline">{email}</span>
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Last active: Today, 9:41 AM
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end">
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-success/50 bg-success px-4 py-2 text-sm font-bold tracking-wide text-white shadow-[0_0_20px_-6px_rgba(74,222,128,0.55)]">
                <RealisticFire />
                1 WEEK STREAK
              </span>
              <Link
                href="/dashboard/profile"
                className="inline-flex min-h-11 items-center text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
              >
                VIEW FULL PROFILE →
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-8 sm:mb-10">
          <AiCoachPanel athleteName={displayName} compact />
        </section>

        <section className="mb-8 sm:mb-10">
          <TrainingCircleFeed />
        </section>

        <section className="mb-8 sm:mb-10">
          <article className="glass-card rounded-2xl border border-silver/10 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  THIS WEEK
                </p>
                <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
                  Recent Activity
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border badge-amber px-3 py-1 text-[10px] font-semibold">
                <Activity className="size-3" aria-hidden="true" />
                {weekSessionCount} {weekSessionCount === 1 ? 'SESSION' : 'SESSIONS'}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekActivity.map((day) => (
                <div key={day.day} className="flex flex-col items-center gap-2">
                  <div
                    className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl"
                    aria-label={
                      day.done
                        ? `${day.day}: trained`
                        : `${day.day}: rest day`
                    }
                  >
                    <StreakFlame
                      active={day.done}
                      className="h-[88%] w-[88%]"
                    />
                  </div>
                  <span className="text-[10px] tracking-wider text-muted-foreground">
                    {day.day}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {lastSessionCaption}
            </p>
          </article>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-[#5865F2]/35 bg-gradient-to-r from-[#5865F2]/15 via-zinc-900/70 to-zinc-950 p-5 sm:mb-10 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#5865F2]/40 bg-[#5865F2]/20 text-[#5865F2]">
                <DiscordIcon className="size-7" />
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.3em] text-[#8ea1ff]">
                  COMMUNITY
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-white">
                  Join our Discord
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Join thousands of lifters. Share PRs, get tips, stay motivated —
                  and never train alone again.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#5865F2] px-7 text-sm font-bold tracking-[0.18em] text-white transition-all hover:scale-[1.02] hover:bg-[#4752c4]"
            >
              <DiscordIcon className="size-5" />
              JOIN DISCORD
            </button>
          </div>
        </section>

        <section className="mb-8 sm:mb-10">
          <div className="mb-6 text-center">
            <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
              THE IRONSTACK WAY
            </p>
            <h2 className="font-heading mt-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
              Why IronStack
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Built for lifters who want smarter training, clearer progress, and
              a community that shows up.
            </p>
          </div>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {WHY_IRONSTACK.map((feature, index) => {
              const tone = ACCENT[toneAt(index)]
              return (
              <article
                key={feature.title}
                className={`glass-card sheen-border group w-[78vw] max-w-xs shrink-0 rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-gold/30 sm:w-auto sm:max-w-none ${tone.edge}`}
              >
                <div className={`mb-4 flex size-11 items-center justify-center rounded-xl ${tone.chip}`}>
                  <feature.icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
              )
            })}
          </div>
        </section>

        <section className="mb-12 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                READY TO TRAIN?
              </p>
              <h2 className="font-heading mt-1 text-2xl font-bold text-foreground md:text-3xl">
                Jump into today&apos;s Workout
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Log lifts, check your streak, and keep the journey moving —
                right from your training command center.
              </p>
            </div>
            <Link
              href="/dashboard/workout"
              className={`cta-pulse inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-8 text-sm font-bold tracking-[0.2em] transition-all hover:scale-[1.02] ${CTA_PRIMARY}`}
            >
              OPEN WORKOUT
            </Link>
          </div>
        </section>

        <footer className="border-t border-silver/10 pt-8 pb-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-gold" aria-hidden="true" />
              <span className="font-heading text-sm font-bold tracking-[0.25em] text-metallic">
                IRONSTACK
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs tracking-[0.2em] text-muted-foreground">
              <button type="button" className="transition-colors hover:text-gold">
                SUPPORT
              </button>
              <button type="button" className="transition-colors hover:text-gold">
                ABOUT
              </button>
              <button type="button" className="transition-colors hover:text-gold">
                CONTACT
              </button>
              <button type="button" className="transition-colors hover:text-gold">
                PRIVACY
              </button>
            </div>
            <p className="text-[10px] tracking-[0.2em] text-zinc-500">
              MADE FOR LIFTERS · 2026
            </p>
          </div>
        </footer>
      </main>

      <FloatingActions />
    </div>
  )
}
