'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CalendarDays,
  Clock3,
  Dumbbell,
  Flame,
  Layers,
  Play,
  Plus,
  Sparkles,
  TrendingUp,
  Trophy,
  Weight,
} from 'lucide-react'
import {
  AnimatePresence,
  useReducedMotion,
} from 'framer-motion'
import { AiCoachPanel } from '@/components/ai-coach-panel'
import { DashboardNav } from '@/components/dashboard-nav'
import { FloatingActions } from '@/components/floating-actions'
import { HubPreloader } from '@/components/hub-preloader'
import { ACCENT, CTA_PRIMARY, toneForFocus } from '@/lib/accent'
import { initialsFrom } from '@/lib/dashboard-utils'
import {
  formatSessionDate,
  formatVolume,
  isSameLocalDay,
  loadSessions,
  type LoggedSession,
} from '@/lib/session-store'

type WorkoutDashboardProps = {
  displayName: string
}

type SavedSplit = {
  id: string
  slug: string
  name: string
  days: number
  lastUsed: string
  focus: string
}

const INTRO_MS = 2100

const SAVED_SPLITS: SavedSplit[] = [
  {
    id: '1',
    slug: 'ppl',
    name: 'Push / Pull / Legs',
    days: 6,
    lastUsed: '2 days ago',
    focus: 'Hypertrophy',
  },
  {
    id: '2',
    slug: 'ul',
    name: 'Upper / Lower',
    days: 4,
    lastUsed: 'Yesterday',
    focus: 'Strength',
  },
  {
    id: '3',
    slug: 'fb',
    name: 'Full Body Power',
    days: 3,
    lastUsed: '5 days ago',
    focus: 'Athletic',
  },
]

const RECOMMENDED_SPLITS = [
  {
    id: 'ppl',
    title: 'Push / Pull / Legs',
    description: '6 days/week · Ideal for intermediate lifters',
    tag: 'Popular',
    icon: Layers,
    recommended: true,
  },
  {
    id: 'ul',
    title: 'Upper / Lower',
    description: '4 days/week · Great balance of recovery & volume',
    tag: 'Balanced',
    icon: Weight,
    recommended: false,
  },
  {
    id: 'fb',
    title: 'Full Body',
    description: '3 days/week · Best for beginners',
    tag: 'Beginner',
    icon: Dumbbell,
    recommended: false,
  },
  {
    id: 'bro',
    title: 'Bro Split',
    description: '5 days/week · Classic body-part focus',
    tag: 'Classic',
    icon: Flame,
    recommended: false,
  },
]

/** Mock volumes (kg) for the demo sessions below, oldest → newest. */
const MOCK_SESSION_VOLUMES = [7600, 8900, 10100, 8400, 9100, 11200]
const JOURNEY_SPARK = [32, 40, 38, 52, 60, 58, 72, 85, 100]
const JOURNEY_BASE_KG = 142500

/** Fallback recap shown until the user logs a real session. */
const MOCK_LAST_SESSION = {
  badge: 'YESTERDAY',
  meta: 'Jul 23 · 58 min',
  title: 'Push Day · Push / Pull / Legs',
  blurb: 'Solid upper-body session with progressive overload on bench.',
  duration: '58m',
  volume: '8.4k kg',
  sets: '18',
  standouts: [
    'Bench Press — 100 kg × 5',
    'Overhead Press — 60 kg × 8',
    'Cable Fly — 18 kg × 12',
  ],
}

const PAST_SESSIONS = [
  {
    id: 's1',
    date: 'Jul 23',
    name: 'Push Day · Push / Pull / Legs',
    duration: '58 min',
    volume: '8.4k kg',
  },
  {
    id: 's2',
    date: 'Jul 21',
    name: 'Pull Day · Push / Pull / Legs',
    duration: '62 min',
    volume: '9.1k kg',
  },
  {
    id: 's3',
    date: 'Jul 19',
    name: 'Legs · Push / Pull / Legs',
    duration: '71 min',
    volume: '11.2k kg',
  },
]

export function WorkoutDashboard({ displayName }: WorkoutDashboardProps) {
  const reduce = useReducedMotion()
  const [introDone, setIntroDone] = useState(false)
  const [previewEmpty, setPreviewEmpty] = useState(false)
  const [logged, setLogged] = useState<LoggedSession[]>([])

  useEffect(() => {
    if (reduce) {
      setIntroDone(true)
      return
    }
    const timer = setTimeout(() => setIntroDone(true), INTRO_MS)
    return () => clearTimeout(timer)
  }, [reduce])

  // Sessions saved from the Active Session flow (localStorage).
  useEffect(() => {
    setLogged(loadSessions())
  }, [])

  const latest = logged.length > 0 ? logged[logged.length - 1] : null

  /** Recap card content: latest real session when one exists, demo data otherwise. */
  const lastSession = useMemo(() => {
    if (!latest) return MOCK_LAST_SESSION
    const started = new Date(latest.startedAt)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const badge = isSameLocalDay(started, now)
      ? 'TODAY'
      : isSameLocalDay(started, yesterday)
        ? 'YESTERDAY'
        : formatSessionDate(latest.startedAt).toUpperCase()
    const minutes = Math.max(1, Math.round(latest.durationSec / 60))

    // Standouts: heaviest completed set per exercise, top 3 by weight.
    const bests: Array<{ name: string; weight: number; reps: number }> = []
    for (const exercise of latest.exercises) {
      let best: { name: string; weight: number; reps: number } | null = null
      for (const set of exercise.sets) {
        if (!set.completed || set.weight <= 0) continue
        if (!best || set.weight > best.weight) {
          best = { name: exercise.name, weight: set.weight, reps: set.reps }
        }
      }
      if (best) bests.push(best)
    }
    bests.sort((a, b) => b.weight - a.weight)

    const hitPr = latest.prs.some((pr) => pr.previousBest !== null)
    return {
      badge,
      meta: `${formatSessionDate(latest.startedAt)} · ${minutes} min`,
      title: `${latest.dayFocus} · ${latest.splitName}`,
      blurb: hitPr
        ? 'New PRs on the board — that recovery is earned.'
        : 'Logged and locked in — every session compounds.',
      duration: `${minutes}m`,
      volume: formatVolume(latest.volumeKg),
      sets:
        latest.setsSkipped > 0
          ? `${latest.setsCompleted} (+${latest.setsSkipped} skipped)`
          : `${latest.setsCompleted}`,
      standouts: bests
        .slice(0, 3)
        .map((b) => `${b.name} — ${b.weight} kg × ${b.reps}`),
    }
  }, [latest])

  /** History list: real sessions first (newest first), padded with demo rows. */
  const historySessions = useMemo(() => {
    const real = [...logged].reverse().map((session) => ({
      id: session.id,
      date: formatSessionDate(session.startedAt),
      name: `${session.dayFocus} · ${session.splitName}`,
      duration: `${Math.max(1, Math.round(session.durationSec / 60))} min`,
      volume: formatVolume(session.volumeKg),
    }))
    return [...real, ...PAST_SESSIONS].slice(0, 3)
  }, [logged])

  /** Volume-trend bars: last 6 session volumes, real sessions appended to demo. */
  const volumeTrend = useMemo(() => {
    const volumes = [
      ...MOCK_SESSION_VOLUMES,
      ...logged.map((session) => session.volumeKg),
    ]
      .filter((v) => Number.isFinite(v) && v >= 0)
      .slice(-6)
    const max = Math.max(...volumes, 1)
    const first = volumes[0]
    const last = volumes[volumes.length - 1]
    const pct =
      volumes.length > 1 && first > 0
        ? Math.round(((last - first) / first) * 100)
        : null
    return {
      bars: volumes.map((v) => Math.max(6, Math.round((v / max) * 100))),
      caption:
        pct === null
          ? `Last ${volumes.length} sessions`
          : `Last ${volumes.length} sessions · ${pct >= 0 ? '+' : ''}${pct}%`,
    }
  }, [logged])

  const journeyTotal =
    JOURNEY_BASE_KG + logged.reduce((sum, session) => sum + (session.volumeKg || 0), 0)

  const savedSplits = previewEmpty ? [] : SAVED_SPLITS
  const hasLastSession = !previewEmpty
  const recentSessions = previewEmpty ? [] : historySessions
  const firstName = displayName.trim().split(/\s+/)[0] || displayName

  return (
    <div className="relative min-h-svh overflow-x-clip pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[55svh] [mask-image:linear-gradient(to_bottom,black_10%,transparent)]">
          <Image
            src="/images/hero-gym.png"
            alt=""
            fill
            className="object-cover opacity-[0.14]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/55 to-background" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(234,179,8,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.09] blur-3xl" />
      </div>

      <AnimatePresence>{!introDone && <HubPreloader />}</AnimatePresence>

      {introDone && (
        <>
          <DashboardNav
            userName={displayName}
            initials={initialsFrom(displayName)}
          />

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
                  WORKOUT
                </p>
                <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                  Ready to train, {firstName}?
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Pick up a saved split, review your last session, or start
                  something new tailored to your level.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmpty((value) => !value)}
                className="inline-flex min-h-11 self-start items-center rounded-full border border-zinc-700 px-3 text-[10px] font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
              >
                {previewEmpty ? 'SHOW SAMPLE DATA' : 'PREVIEW EMPTY STATES'}
              </button>
            </div>

            {/* Total Volume + Progress — first section */}
            <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-card p-5 sm:mb-10 sm:p-8">
              <div
                className="pointer-events-none absolute -top-20 -right-16 h-52 w-52 rounded-full bg-gold/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                    YOUR JOURNEY
                  </p>
                  <p className="font-heading mt-3 text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl">
                    {journeyTotal.toLocaleString()}{' '}
                    <span className="text-2xl font-semibold text-gold sm:text-3xl">
                      kg
                    </span>
                  </p>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    lifted since you joined IronStack
                  </p>
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-success/30 bg-success-tint p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border chip-green">
                      <TrendingUp className="size-4" aria-hidden="true" />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Your average load has increased{' '}
                      <span className="font-semibold text-success">18%</span>{' '}
                      over the last 8 weeks — your Bench Press and Squat numbers
                      are trending up.
                    </p>
                  </div>
                </div>

                <div className="w-full shrink-0 rounded-2xl border border-border bg-background p-4 lg:w-64">
                  <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                    8-WEEK TREND
                  </p>
                  <div
                    className="flex h-24 items-end gap-1.5"
                    aria-hidden="true"
                  >
                    {JOURNEY_SPARK.map((height, index) => (
                      <div
                        key={index}
                        className="w-full rounded-t-sm bg-gradient-to-t from-success/20 to-success/85"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                    +18% average load
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8 sm:mb-10">
              <AiCoachPanel athleteName={displayName} compact />
            </section>

            {/* Your Splits */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                  PRIMARY
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-white md:text-3xl">
                  Your Splits
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jump straight into a session with one of your saved programs.
                </p>
              </div>

              {savedSplits.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gold/30 bg-zinc-900/40 px-6 py-16 text-center backdrop-blur-md">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
                    <Layers className="size-7" aria-hidden="true" />
                  </div>
                  <p className="font-heading text-lg font-semibold text-white">
                    No splits yet
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    No splits yet — choose or create one below to start building
                    your training rhythm.
                  </p>
                </div>
              ) : (
                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3">
                  {savedSplits.map((split) => {
                    const tone = ACCENT[toneForFocus(split.focus)]
                    return (
                    <article
                      key={split.id}
                      className={`group relative flex w-[85vw] max-w-sm shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-gold/30 md:w-auto md:max-w-none ${tone.edge}`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className={`flex size-11 items-center justify-center rounded-xl ${tone.chip}`}>
                          <Dumbbell className="size-5" aria-hidden="true" />
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] ${tone.badge}`}>
                          {split.focus.toUpperCase()}
                        </span>
                      </div>

                      <h3 className="font-heading text-xl font-bold text-foreground">
                        {split.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays
                            className={`size-3.5 ${tone.text}`}
                            aria-hidden="true"
                          />
                          {split.days} days / week
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3
                            className={`size-3.5 ${tone.text}`}
                            aria-hidden="true"
                          />
                          Last used {split.lastUsed}
                        </span>
                      </div>

                      <Link
                        href={`/dashboard/splits/${split.slug}/session`}
                        className={`mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold tracking-[0.18em] transition-all duration-200 hover:scale-[1.02] ${CTA_PRIMARY}`}
                      >
                        <Play
                          className="size-4 fill-current"
                          aria-hidden="true"
                        />
                        START SESSION
                      </Link>
                    </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Last Session Summary */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  RECAP
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-white">
                  Last Session Summary
                </h2>
              </div>

              {!hasLastSession ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-zinc-900/35 px-6 py-14 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-silver/20 bg-silver/5 text-silver">
                    <Trophy className="size-6" aria-hidden="true" />
                  </div>
                  <p className="font-heading text-lg font-semibold text-white">
                    No sessions logged yet
                  </p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    No sessions logged yet — your first recap will show up here
                    after you finish a workout.
                  </p>
                </div>
              ) : (
                <article className="glass-card rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <div className="flex flex-col gap-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border badge-amber px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]">
                          {lastSession.badge}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lastSession.meta}
                        </span>
                      </div>
                      <h3 className="font-heading mt-3 text-xl font-bold text-foreground sm:text-2xl">
                        {lastSession.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lastSession.blurb}
                      </p>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { label: 'Duration', value: lastSession.duration, icon: Clock3 },
                          { label: 'Volume', value: lastSession.volume, icon: Weight },
                          { label: 'Sets', value: lastSession.sets, icon: Layers },
                        ].map((stat) => (
                          <div
                            key={stat.label}
                            className="rounded-xl border border-silver/10 bg-zinc-950/50 p-3"
                          >
                            <stat.icon
                              className="mb-2 size-4 text-gold"
                              aria-hidden="true"
                            />
                            <p className="font-heading text-lg font-bold tabular-nums text-white">
                              {stat.value}
                            </p>
                            <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                              {stat.label.toUpperCase()}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-2.5">
                        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                          STANDOUT LIFTS
                        </p>
                        {lastSession.standouts.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No completed sets logged this session.
                          </p>
                        )}
                        {lastSession.standouts.map((lift) => (
                          <div
                            key={lift}
                            className="flex min-h-11 items-center gap-3 rounded-xl border border-silver/10 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-gold/30 hover:bg-gold/5"
                          >
                            <Dumbbell
                              className="size-4 shrink-0 text-gold"
                              aria-hidden="true"
                            />
                            {lift}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-full rounded-xl border border-border bg-background p-4">
                      <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                        VOLUME TREND
                      </p>
                      <div
                        className="flex h-28 items-end gap-1.5"
                        aria-hidden="true"
                      >
                        {volumeTrend.bars.map((height, index) => (
                          <div
                            key={index}
                            className="w-full rounded-t-sm bg-gradient-to-t from-success/20 to-success/80 transition-all hover:to-success"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <p className="mt-3 text-xs font-semibold text-success">
                        {volumeTrend.caption}
                      </p>
                    </div>
                  </div>
                </article>
              )}
            </section>

            {/* Workout Sessions — last 3 */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                  HISTORY
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-white">
                  Workout Sessions
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your 3 most recent training sessions.
                </p>
              </div>

              {recentSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-zinc-900/35 px-6 py-12 text-center">
                  <p className="font-heading text-lg font-semibold text-white">
                    No workout sessions yet
                  </p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Finish your first session and it will land here in your
                    history.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-silver/10 bg-zinc-900/50 px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-gold/[0.04] sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                          <Dumbbell className="size-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-heading text-base font-semibold text-white">
                            {session.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {session.date}
                          </p>
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                        <div>
                          <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                            DURATION
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-200">
                            {session.duration}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                            VOLUME
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-gold">
                            {session.volume}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Choose a Split */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                  RECOMMENDED FOR YOU
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-white">
                  Choose a Split
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Suggestions based on your lifestyle and gym level — tap one to
                  select it.
                </p>
              </div>

              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
                {RECOMMENDED_SPLITS.map((split) => {
                  const selected = split.recommended
                  return (
                    <Link
                      key={split.id}
                      href={`/dashboard/splits/${split.id}`}
                      className={`relative flex w-[78vw] max-w-xs shrink-0 flex-col rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 sm:w-auto sm:max-w-none ${
                        selected
                          ? 'border-gold/50 bg-gold/10 shadow-[0_0_28px_-10px_rgba(234,179,8,0.45)]'
                          : 'border-silver/10 bg-zinc-900/50 hover:border-gold/30'
                      }`}
                    >
                      {split.recommended && (
                        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full border badge-amber px-2.5 py-0.5 text-[9px] font-bold tracking-[0.15em]">
                          <Sparkles className="size-3" aria-hidden="true" />
                          RECOMMENDED
                        </span>
                      )}

                      <div
                        className={`mb-4 flex size-10 items-center justify-center rounded-xl ${
                          selected
                            ? 'border chip-amber'
                            : 'border border-border bg-background text-silver'
                        }`}
                      >
                        <split.icon className="size-5" aria-hidden="true" />
                      </div>
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {split.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {split.description}
                      </p>
                      <span
                        className={`mt-4 inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] ${
                          selected
                            ? 'badge-amber'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {split.tag.toUpperCase()}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>

            {/* Create Your Own Split */}
            <section className="mb-6">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  CUSTOM
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-white">
                  Create Your Own Split
                </h2>
              </div>

              <Link
                href="/dashboard/splits/create"
                className="group flex min-h-14 w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gold/35 bg-zinc-900/30 px-6 py-12 text-center transition-all duration-200 hover:border-gold/60 hover:bg-gold/5 hover:shadow-[0_0_32px_-12px_rgba(234,179,8,0.4)] sm:py-14"
              >
                <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition-transform duration-200 group-hover:scale-110">
                  <Plus className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-heading text-xl font-bold text-white">
                    + Create Custom Split
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Build a split tailored exactly to your goals, schedule, and
                    recovery — pick from 800+ exercises.
                  </p>
                </div>
              </Link>
            </section>
          </main>

          <FloatingActions />
        </>
      )}
    </div>
  )
}
