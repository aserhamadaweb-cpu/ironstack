'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Bot,
  Dumbbell,
  Flame,
  History,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion'
import { DashboardNav } from '@/components/dashboard-nav'
import { EASE } from '@/components/reveal'
import { HubPreloader } from '@/components/hub-preloader'
import {
  hasSeenHubIntro,
  markHubIntroSeen,
} from '@/components/route-preloader'
import { StatCard, type StatCardData } from '@/components/stat-card'
import { getTrainingStats, initialsFrom } from '@/lib/dashboard-utils'
import { MOCK_PRS, formatLiftDate, formatWeight } from '@/lib/mock-pr-data'

type DashboardHubProps = {
  displayName: string
  email: string
}

/** How long the cinematic intro plays (once per tab session). */
const INTRO_MS = 900

/** Static preview bars (visual only) for the hero card + trend widget. */
const HERO_BARS = [42, 55, 48, 64, 78, 100]
const TREND_BARS = [35, 52, 44, 62, 74, 100]

const goldGlow =
  'hover:border-gold/50 hover:shadow-[0_0_28px_-6px_rgba(198,40,40,0.4)]'
const silverGlow =
  'hover:border-silver/40 hover:shadow-[0_0_24px_-6px_rgba(226,232,240,0.28)]'

/** Tiny hex-nut silhouette (hexagon + bore hole), like a barbell collar nut. */
function HexNut({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  )
}

// Deterministic scatter of small golden nuts floating in the backdrop.
const NUTS = [
  { left: '6%', top: '18%', size: 18, delay: 0, duration: 9 },
  { left: '14%', top: '58%', size: 13, delay: 1.4, duration: 11 },
  { left: '23%', top: '32%', size: 15, delay: 2.6, duration: 10 },
  { left: '34%', top: '74%', size: 12, delay: 0.8, duration: 12 },
  { left: '46%', top: '14%', size: 14, delay: 2.0, duration: 9.5 },
  { left: '58%', top: '66%', size: 17, delay: 3.2, duration: 11.5 },
  { left: '68%', top: '24%', size: 12, delay: 1.0, duration: 10.5 },
  { left: '78%', top: '52%', size: 16, delay: 2.4, duration: 9 },
  { left: '88%', top: '20%', size: 13, delay: 0.4, duration: 12 },
  { left: '92%', top: '70%', size: 18, delay: 1.8, duration: 10 },
]

export function DashboardHub({ displayName, email }: DashboardHubProps) {
  const reduce = useReducedMotion()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (reduce || hasSeenHubIntro()) {
      setShowIntro(false)
      return
    }
    setShowIntro(true)
    const timer = setTimeout(() => {
      markHubIntroSeen()
      setShowIntro(false)
    }, INTRO_MS)
    return () => clearTimeout(timer)
  }, [reduce])

  const stats = getTrainingStats()

  const sortedByDate = [...MOCK_PRS].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
  )
  const lastSession = sortedByDate[0]
  const firstSession = sortedByDate[sortedByDate.length - 1]

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

  const firstName = displayName.trim().split(/\s+/)[0] || displayName

  // Weighty, deliberate rise-in used across the staggered reveal.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 26 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: EASE, delay },
  })

  const statsContainer: Variants = {
    hidden: {},
    visible: {
      transition: { delayChildren: 0.22, staggerChildren: 0.09 },
    },
  }
  const statsItem: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  }

  return (
    <div className="relative min-h-svh overflow-x-clip">
      {/* ---- Ambient background: gym scene + drifting gold/red lights ---- */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        {/* Faint gym photo, like the welcome page, fading out downward */}
        <div className="absolute inset-x-0 top-0 h-[75svh] [mask-image:linear-gradient(to_bottom,black_20%,transparent)]">
          <Image
            src="/images/hero-gym.png"
            alt=""
            fill
            className="object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
        </div>

        {/* Gold glow from the top + faint dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(198,40,40,0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(214,214,224,0.05)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_15%,black,transparent_75%)]" />

        {/* Drifting golden lights with a touch of red */}
        <motion.div
          className="absolute -top-20 left-[8%] h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-3xl"
          animate={
            reduce
              ? undefined
              : { x: [0, 40, 0], y: [0, 24, 0], scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }
          }
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[30%] -right-32 h-96 w-96 rounded-full bg-gold/[0.08] blur-3xl"
          animate={
            reduce
              ? undefined
              : { x: [0, -36, 0], y: [0, -20, 0], scale: [1, 1.2, 1], opacity: [0.4, 0.75, 0.4] }
          }
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute bottom-[-8rem] left-[22%] h-[24rem] w-[24rem] rounded-full bg-primary/10 blur-3xl"
          animate={
            reduce
              ? undefined
              : { x: [0, 30, 0], y: [0, -26, 0], scale: [1, 1.12, 1], opacity: [0.35, 0.65, 0.35] }
          }
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute top-[12%] right-[24%] h-56 w-56 rounded-full bg-primary/[0.07] blur-3xl"
          animate={
            reduce
              ? undefined
              : { y: [0, 22, 0], scale: [1, 1.18, 1], opacity: [0.3, 0.6, 0.3] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />

        {/* Small golden nuts drifting with a soft glow */}
        {NUTS.map((nut, i) => (
          <motion.div
            key={i}
            className="absolute text-gold/30 drop-shadow-[0_0_6px_rgba(198,40,40,0.45)]"
            style={{ left: nut.left, top: nut.top, width: nut.size, height: nut.size }}
            animate={
              reduce
                ? undefined
                : {
                    y: [0, -14, 0],
                    rotate: [0, 25, 0],
                    opacity: [0.25, 0.6, 0.25],
                  }
            }
            transition={{
              duration: nut.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: nut.delay,
            }}
          >
            <HexNut className="size-full" />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>{showIntro && <HubPreloader />}</AnimatePresence>

      <motion.div {...rise(0)}>
        <DashboardNav
          userName={displayName}
          initials={initialsFrom(displayName)}
        />
      </motion.div>

      <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
            {/* Header + streak badge */}
            <motion.div className="mb-10 flex flex-col gap-2" {...rise(0.1)}>
              <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
                YOUR HUB
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="font-heading text-metallic text-3xl font-bold tracking-tight md:text-4xl">
                  Welcome back, {firstName}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold tracking-wide text-gold shadow-[0_0_18px_-6px_rgba(198,40,40,0.55)]">
                  <Flame
                    className="size-3.5 fill-orange-500 text-orange-500"
                    aria-hidden="true"
                  />
                  1 WEEK STREAK
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Pick where you want to train today. Your progress is waiting.
              </p>
            </motion.div>

            {/* Profile + stat cards */}
            <motion.section
              className="mb-8 grid gap-4 md:grid-cols-[1.1fr_2fr]"
              variants={statsContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                variants={statsItem}
                whileHover={reduce ? undefined : { y: -4, scale: 1.01 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <Link
                  href="/dashboard/profile"
                  prefetch={false}
                  className={`glass-card sheen-border group flex h-full items-center gap-4 rounded-2xl border border-transparent p-6 transition-all duration-200 ${goldGlow}`}
                >
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-lg font-bold text-gold">
                    {initialsFrom(displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-lg font-bold text-foreground">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {email}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-gold group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </Link>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {statCards.map((stat) => (
                  <StatCard key={stat.label} stat={stat} variants={statsItem} />
                ))}
              </div>
            </motion.section>

            {/* Hero Lift Tracker + right rail */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* HERO — Lift Tracker */}
              <motion.div
                className="lg:col-span-2"
                {...rise(0.42)}
                whileHover={reduce ? undefined : { y: -6, scale: 1.01 }}
              >
                <Link
                  href="/dashboard/lift-tracker"
                  className="group relative flex h-full min-h-72 flex-col justify-between overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/15 via-gold/[0.04] to-transparent p-8 backdrop-blur-md transition-all duration-200 hover:border-gold/60 hover:shadow-[0_0_44px_-8px_rgba(198,40,40,0.45)] md:p-10"
                >
                  <Dumbbell
                    className="absolute -right-6 -bottom-8 size-52 -rotate-12 text-gold opacity-[0.07] transition-transform duration-500 group-hover:-rotate-6"
                    aria-hidden="true"
                  />

                  <div className="relative">
                    <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
                      FEATURED
                    </p>
                    <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                      Lift Tracker
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                      Log every set, chase every gram of progress. Your working
                      weights, session history, and new bests — all in one
                      place.
                    </p>
                  </div>

                  <div className="relative mt-8 flex items-end justify-between gap-6">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-bold tracking-[0.2em] text-primary-foreground transition-all duration-200 group-hover:brightness-110">
                      OPEN TRACKER
                      <ArrowRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>

                    {/* Mini volume-preview chart (visual only) */}
                    <div
                      className="hidden h-20 flex-1 items-end gap-1.5 sm:flex md:max-w-56"
                      aria-hidden="true"
                    >
                      {HERO_BARS.map((height, i) => (
                        <div
                          key={i}
                          className="w-full rounded-t-sm bg-gradient-to-t from-gold/25 to-gold/80 transition-all duration-300 group-hover:to-gold"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* Right rail */}
              <div className="flex flex-col gap-6">
                {/* Performance snapshot */}
                <motion.section
                  className={`glass-card rounded-2xl border border-silver/10 p-6 transition-all duration-200 ${silverGlow}`}
                  {...rise(0.54)}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[10px] font-semibold tracking-[0.25em] text-muted-foreground">
                      LAST SESSION
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
                      <TrendingUp className="size-3" aria-hidden="true" />
                      +19%
                    </span>
                  </div>
                  <p className="font-heading text-xl font-bold text-foreground">
                    {lastSession.liftName}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatWeight(lastSession.weight, lastSession.unit)} ×{' '}
                    {lastSession.reps} ·{' '}
                    <span className="text-xs">
                      {formatLiftDate(lastSession.loggedAt)}
                    </span>
                  </p>
                  <div
                    className="mt-4 flex h-10 items-end gap-1"
                    aria-hidden="true"
                  >
                    {TREND_BARS.map((height, i) => (
                      <div
                        key={i}
                        className="w-full rounded-t-sm bg-gradient-to-t from-silver/15 to-silver/50"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </motion.section>

                {/* Your Journey (replaces Community Circle) */}
                <motion.div
                  className="flex-1"
                  {...rise(0.64)}
                  whileHover={reduce ? undefined : { y: -4, scale: 1.01 }}
                >
                  <Link
                    href="#"
                    className={`glass-card sheen-border group flex h-full flex-col rounded-2xl border border-transparent p-6 transition-all duration-200 ${goldGlow}`}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
                        <History className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="font-heading text-lg font-semibold text-foreground">
                          Your Journey
                        </h2>
                        <p className="text-[10px] tracking-[0.2em] text-muted-foreground">
                          FULL HISTORY
                        </p>
                      </div>
                    </div>

                    {/* Timeline preview */}
                    <div className="ml-1.5 flex-1 border-l border-gold/25 pl-4 text-xs">
                      <div className="relative pb-4">
                        <span className="absolute top-1 -left-[21.5px] size-2 rounded-full bg-gold/50" />
                        <p className="font-medium text-foreground">
                          First session
                        </p>
                        <p className="text-muted-foreground">
                          {firstSession.liftName} ·{' '}
                          {formatLiftDate(firstSession.loggedAt)}
                        </p>
                      </div>
                      <div className="relative">
                        <span className="absolute top-1 -left-[21.5px] size-2 rounded-full bg-gold shadow-[0_0_8px_rgba(198,40,40,0.7)]" />
                        <p className="font-medium text-foreground">
                          Latest session
                        </p>
                        <p className="text-muted-foreground">
                          {lastSession.liftName} ·{' '}
                          {formatLiftDate(lastSession.loggedAt)}
                        </p>
                      </div>
                    </div>

                    <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground transition-colors duration-200 group-hover:text-gold">
                      VIEW FULL HISTORY
                      <ArrowRight
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </motion.div>
              </div>
            </div>
          </main>

          {/* ---- Floating AI Coach button ---- */}
          <motion.div
            className="fixed right-6 bottom-6 z-50"
            initial={{ opacity: 0, scale: 0.5, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 240, damping: 18 }}
          >
            <Link
              href="/dashboard/ai-coach"
              aria-label="Open AI Coach"
              className="group relative flex size-14 items-center justify-center rounded-full border border-gold/50 bg-gradient-to-br from-gold to-amber-600 shadow-[0_8px_30px_-6px_rgba(198,40,40,0.55)] transition-transform duration-200 hover:scale-110 active:scale-95"
            >
              {!reduce && (
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-gold/60"
                  animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  aria-hidden="true"
                />
              )}
              <Bot className="size-7 text-background" aria-hidden="true" />
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-gold">
                <Dumbbell className="size-2.5 text-background" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>
    </div>
  )
}
