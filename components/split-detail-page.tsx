'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  Check,
  Dumbbell,
  ListOrdered,
  Play,
  Sparkles,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExerciseCard } from '@/components/exercise-card'
import { FloatingActions } from '@/components/floating-actions'
import { EASE } from '@/components/reveal'
import { countExercises, type SplitDetail } from '@/lib/split-data'

type SplitDetailPageProps = {
  split: SplitDetail
  displayName: string
  initials: string
}

export function SplitDetailPage({ split, displayName, initials }: SplitDetailPageProps) {
  const reduce = useReducedMotion()
  const [saved, setSaved] = useState(false)
  const totalExercises = countExercises(split)

  const list: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
  }
  const row: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  }

  return (
    <div className="relative min-h-svh overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(234,179,8,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} />

      {/* Page enters with a slide-up + scale-fade from the split card */}
      <motion.main
        className="mx-auto max-w-4xl px-6 pt-8 pb-32 md:pt-12"
        initial={{ opacity: 0, y: reduce ? 0 : 28, scale: reduce ? 1 : 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <Link
          href="/dashboard/workout"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-zinc-400 transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          BACK TO WORKOUT
        </Link>

        {/* ---- Header ---- */}
        <header className="mb-10 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/12 via-zinc-900/70 to-zinc-950 p-6 shadow-[0_0_50px_-18px_rgba(234,179,8,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-gold">
              {split.tag.toUpperCase()}
            </span>
            {split.recommended && (
              <span className="inline-flex items-center gap-1 rounded-full border badge-amber px-2.5 py-1 text-[9px] font-bold tracking-[0.15em]">
                <Sparkles className="size-3" aria-hidden="true" />
                RECOMMENDED
              </span>
            )}
          </div>

          <h1 className="font-heading mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            {split.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-zinc-300">{split.description}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {split.summary}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl border border-silver/15 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300">
              <CalendarDays className="size-3.5 text-gold" aria-hidden="true" />
              {split.daysPerWeek} days / week
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-silver/15 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300">
              <ListOrdered className="size-3.5 text-gold" aria-hidden="true" />
              {totalExercises} exercises
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-silver/15 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300">
              <Dumbbell className="size-3.5 text-gold" aria-hidden="true" />
              {split.schedule.length} unique {split.schedule.length === 1 ? 'day' : 'days'}
            </span>
          </div>
        </header>

        {/* ---- Exercise list grouped by day ---- */}
        <motion.div variants={list} initial="hidden" animate="visible">
          {split.schedule.map((day, dayIndex) => (
            <section key={day.id} className="mb-10">
              <motion.div
                variants={row}
                className="mb-4 flex items-end justify-between gap-4 border-b border-silver/10 pb-3"
              >
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                    DAY {dayIndex + 1}
                  </p>
                  <h2 className="font-heading mt-1 text-xl font-bold text-white sm:text-2xl">
                    {day.focus}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{day.note}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
                  {day.exercises.length} EXERCISES
                </span>
              </motion.div>

              <div className="flex flex-col gap-2.5">
                {day.exercises.map((exercise, index) => (
                  <motion.article
                    key={exercise.id}
                    variants={row}
                    className="group rounded-2xl border border-silver/10 bg-zinc-900/50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-silver/25 hover:bg-zinc-900/80 sm:p-4"
                  >
                    <ExerciseCard
                      index={index}
                      name={exercise.name}
                      muscles={[exercise.muscle]}
                      image={exercise.image}
                      setsReps={`${exercise.sets} sets × ${exercise.reps} reps`}
                    />
                  </motion.article>
                ))}
              </div>
            </section>
          ))}
        </motion.div>
      </motion.main>

      {/* ---- Sticky primary CTA ---- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-silver/10 bg-background/85 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 sm:gap-4">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-semibold text-white">{split.name}</p>
            <p className="text-xs text-zinc-500">
              {split.daysPerWeek} days / week · {totalExercises} exercises
            </p>
          </div>

          <motion.button
            type="button"
            onClick={() => setSaved(true)}
            aria-live="polite"
            className={`relative flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full border text-sm font-bold tracking-[0.18em] transition-colors duration-300 sm:flex-none sm:px-7 ${
              saved
                ? 'border-success bg-success text-background'
                : 'border-silver/25 bg-transparent text-zinc-200 hover:border-silver/50 hover:text-white'
            }`}
            whileTap={{ scale: 0.97 }}
            animate={
              saved && !reduce
                ? {
                    boxShadow: [
                      '0 0 0 0 rgba(234,179,8,0.6)',
                      '0 0 34px 8px rgba(234,179,8,0.45)',
                      '0 0 0 0 rgba(234,179,8,0)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {saved ? (
                <motion.span
                  key="saved"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -10 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  <Check className="size-4" aria-hidden="true" />
                  SAVED
                </motion.span>
              ) : (
                <motion.span
                  key="save"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -10 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  <BookmarkPlus className="size-4" aria-hidden="true" />
                  SAVE
                  <span className="hidden lg:inline">TO SESSIONS</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <Link
            href={`/dashboard/splits/${split.slug}/session`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold tracking-[0.18em] text-primary-foreground transition-all hover:scale-[1.01] hover:bg-primary/90 sm:flex-none sm:px-8"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            START SESSION
          </Link>
        </div>
      </div>

      <FloatingActions />
    </div>
  )
}
