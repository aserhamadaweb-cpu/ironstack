'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flag,
  Layers,
  Save,
  Sparkles,
  Trophy,
  Weight,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { EASE } from '@/components/reveal'
import type { SplitDetail } from '@/lib/split-data'
import {
  formatClock,
  formatVolume,
  getPreviousBest,
  loadSessions,
  saveSession,
  type LoggedExercise,
  type LoggedSession,
  type PreviousBest,
  type SessionPr,
} from '@/lib/session-store'

type ActiveSessionProps = {
  split: SplitDetail
  displayName: string
  initials: string
}

type SetEntry = {
  weight: string
  reps: string
  done: boolean
  missWeight: boolean
  missReps: boolean
}

type Stage = 'pick' | 'lift' | 'done' | 'summary'

function makeEntries(count: number): SetEntry[] {
  return Array.from({ length: count }, () => ({
    weight: '',
    reps: '',
    done: false,
    missWeight: false,
    missReps: false,
  }))
}

export function ActiveSession({ split, displayName, initials }: ActiveSessionProps) {
  const router = useRouter()
  const reduce = useReducedMotion()

  /** Stored history — null until read from localStorage after mount. */
  const [sessions, setSessions] = useState<LoggedSession[] | null>(null)
  const isFirstEver = sessions !== null && sessions.length === 0

  const [stage, setStage] = useState<Stage>('pick')
  const [dayIndex, setDayIndex] = useState(0)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [entries, setEntries] = useState<SetEntry[]>([])
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)

  const startRef = useRef<number | null>(null)
  const finalSecRef = useRef(0)
  const missTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    setSessions(loadSessions())
  }, [])

  /** Best-ever weight per exercise name, from all stored history. */
  const previousBests = useMemo(() => {
    const map: Record<string, PreviousBest | null> = {}
    if (!sessions) return map
    for (const day of split.schedule) {
      for (const exercise of day.exercises) {
        if (!(exercise.name in map)) {
          map[exercise.name] = getPreviousBest(sessions, exercise.name)
        }
      }
    }
    return map
  }, [sessions, split])

  // Running timer — counts up continuously while the session is live,
  // including between exercises; stops when the summary is shown.
  useEffect(() => {
    if (stage !== 'lift' && stage !== 'done') return
    const id = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }
    }, 500)
    return () => clearInterval(id)
  }, [stage])

  const day = split.schedule[dayIndex]
  const exercise = day.exercises[exerciseIndex]

  const startSession = (index: number) => {
    setDayIndex(index)
    setExerciseIndex(0)
    setEntries(makeEntries(split.schedule[index].exercises[0].sets))
    startRef.current = Date.now()
    setElapsed(0)
    setStage('lift')
  }

  const toggleSet = (index: number) => {
    const entry = entries[index]
    if (!entry) return

    if (entry.done) {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, done: false } : e))
      )
      return
    }

    const missWeight = !(Number.parseFloat(entry.weight) > 0)
    const missReps = !(Number.parseInt(entry.reps, 10) > 0)

    if (missWeight || missReps) {
      // Refuse to complete and briefly highlight the missing field(s).
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, missWeight, missReps } : e))
      )
      const existing = missTimersRef.current.get(index)
      if (existing) clearTimeout(existing)
      missTimersRef.current.set(
        index,
        setTimeout(() => {
          setEntries((prev) =>
            prev.map((e, i) =>
              i === index ? { ...e, missWeight: false, missReps: false } : e
            )
          )
        }, 1400)
      )
      return
    }

    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, done: true } : e))
    )
  }

  const updateEntry = (index: number, patch: Partial<SetEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  const finishExercise = () => {
    // Unchecked rows are kept but flagged skipped — excluded from volume + PRs.
    const logged: LoggedExercise = {
      name: exercise.name,
      muscle: exercise.muscle,
      image: exercise.image,
      targetSets: exercise.sets,
      targetReps: exercise.reps,
      sets: entries.map((entry, i) => ({
        setNumber: i + 1,
        weight: Number.parseFloat(entry.weight) || 0,
        reps: Number.parseInt(entry.reps, 10) || 0,
        completed: entry.done,
      })),
    }
    setLoggedExercises((prev) => [...prev, logged])

    if (exerciseIndex + 1 < day.exercises.length) {
      setExerciseIndex(exerciseIndex + 1)
      setEntries(makeEntries(day.exercises[exerciseIndex + 1].sets))
    } else {
      setStage('done')
    }
  }

  const finishSession = () => {
    finalSecRef.current =
      startRef.current !== null
        ? Math.floor((Date.now() - startRef.current) / 1000)
        : elapsed
    setStage('summary')
  }

  const summary = useMemo(() => {
    let volumeKg = 0
    let setsCompleted = 0
    let setsSkipped = 0
    const prs: SessionPr[] = []
    const baselines: Array<{ exercise: string; weight: number; reps: number }> = []

    for (const logged of loggedExercises) {
      let bestThis: { weight: number; reps: number } | null = null
      for (const set of logged.sets) {
        if (!set.completed) {
          setsSkipped += 1
          continue
        }
        setsCompleted += 1
        volumeKg += set.weight * set.reps
        if (set.weight > 0 && (!bestThis || set.weight > bestThis.weight)) {
          bestThis = { weight: set.weight, reps: set.reps }
        }
      }
      if (!bestThis) continue

      const previous = previousBests[logged.name]
      if (!previous) {
        baselines.push({ exercise: logged.name, ...bestThis })
      } else if (bestThis.weight > previous.weight) {
        prs.push({
          exercise: logged.name,
          weight: bestThis.weight,
          reps: bestThis.reps,
          previousBest: previous.weight,
        })
      }
    }

    return { volumeKg, setsCompleted, setsSkipped, prs, baselines }
  }, [loggedExercises, previousBests])

  const handleSave = () => {
    if (saving) return
    setSaving(true)
    const session: LoggedSession = {
      id: `sess-${Date.now()}`,
      splitSlug: split.slug,
      splitName: split.name,
      dayFocus: day.focus,
      startedAt: new Date(startRef.current ?? Date.now()).toISOString(),
      durationSec: finalSecRef.current,
      volumeKg: summary.volumeKg,
      setsCompleted: summary.setsCompleted,
      setsSkipped: summary.setsSkipped,
      exercises: loggedExercises,
      prs: [
        ...summary.prs,
        ...summary.baselines.map((b) => ({
          exercise: b.exercise,
          weight: b.weight,
          reps: b.reps,
          previousBest: null,
        })),
      ],
    }
    saveSession(session)
    router.push('/dashboard/workout')
  }

  const uncheckedCount = entries.filter((e) => !e.done).length
  const isLastExercise = exerciseIndex === day.exercises.length - 1

  return (
    <div className="relative min-h-svh overflow-x-clip pb-24 md:pb-10">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(234,179,8,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} />

      {/* ---- Sticky session timer bar (always visible once live) ---- */}
      {(stage === 'lift' || stage === 'done') && (
        <div className="sticky top-14 z-40 border-b border-silver/10 bg-background/90 backdrop-blur-xl sm:top-16">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.25em] text-gold">
                {day.focus.toUpperCase()}
              </p>
              <p className="truncate text-xs text-muted-foreground">{split.name}</p>
            </div>
            <div className="flex items-center gap-4">
              {stage === 'lift' && (
                <span className="hidden text-[10px] font-semibold tracking-[0.18em] text-muted-foreground sm:inline">
                  EXERCISE {exerciseIndex + 1} OF {day.exercises.length}
                </span>
              )}
              <span
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 font-heading text-lg font-bold tabular-nums text-gold"
                aria-label="Session timer"
              >
                <Clock3 className="size-4" aria-hidden="true" />
                {formatClock(elapsed)}
              </span>
            </div>
          </div>
          {stage === 'lift' && (
            <div className="h-1 w-full bg-zinc-800" aria-hidden="true">
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{
                  width: `${((exerciseIndex + 1) / day.exercises.length) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 md:pt-10">
        {/* ================= DAY PICKER ================= */}
        {stage === 'pick' && (
          <section>
            <Link
              href="/dashboard/workout"
              className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-zinc-400 transition-colors hover:text-gold"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              BACK TO WORKOUT
            </Link>

            <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
              ACTIVE SESSION
            </p>
            <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-white md:text-4xl">
              {split.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick today&apos;s training day — the timer starts as soon as you choose.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {split.schedule.map((scheduleDay, index) => (
                <button
                  key={scheduleDay.id}
                  type="button"
                  onClick={() => startSession(index)}
                  className="group flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-silver/10 bg-zinc-900/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/[0.05] sm:p-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-sm font-bold tabular-nums text-gold">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-base font-semibold text-white sm:text-lg">
                        {scheduleDay.focus}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {scheduleDay.note} · {scheduleDay.exercises.length} exercises
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="size-5 shrink-0 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-gold"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ================= LIVE EXERCISE VIEW ================= */}
        {stage === 'lift' && (
          <>
            {isFirstEver && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.07] p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border chip-amber">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    This is your first logged session
                  </span>{' '}
                  — there&apos;s nothing to compare against yet. Everything you log
                  today becomes your starting baseline.
                </p>
              </div>
            )}

            <p className="mb-4 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground sm:hidden">
              EXERCISE {exerciseIndex + 1} OF {day.exercises.length}
            </p>

            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={exercise.id}
                initial={{ opacity: 0, x: reduce ? 0 : 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduce ? 0 : -40 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {/* Current exercise hero */}
                <div className="glass-card rounded-2xl border border-silver/10 p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <ExerciseThumb
                      muscle={exercise.muscle}
                      image={exercise.image}
                      name={exercise.name}
                      className="size-20 sm:size-24"
                    />
                    <div className="min-w-0">
                      <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">
                        {exercise.name}
                      </h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Target: {exercise.sets} sets × {exercise.reps} reps
                      </p>
                      <span className="mt-2 inline-block rounded-full border border-silver/20 bg-zinc-950/60 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-400">
                        {exercise.muscle.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Set rows */}
                <div className="mt-4 flex flex-col gap-2.5">
                  {entries.map((entry, index) => {
                    const previous = previousBests[exercise.name]
                    return (
                      <div
                        key={index}
                        className={`rounded-2xl border p-3 transition-all duration-200 sm:p-4 ${
                          entry.done
                            ? 'border-success/40 bg-success/[0.07] opacity-75'
                            : 'border-silver/10 bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">
                              Set {index + 1}
                            </p>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              {previous
                                ? `Previous: ${previous.weight} kg × ${previous.reps}`
                                : 'Previous: —'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5">
                              <span className="sr-only">
                                Weight for set {index + 1} in kilograms
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.5"
                                placeholder="0"
                                value={entry.weight}
                                disabled={entry.done}
                                onChange={(e) =>
                                  updateEntry(index, {
                                    weight: e.target.value,
                                    missWeight: false,
                                  })
                                }
                                className={`h-11 w-20 rounded-xl border bg-zinc-950/70 px-3 text-center text-sm font-semibold tabular-nums text-white outline-none transition placeholder:text-zinc-600 focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60 ${
                                  entry.missWeight
                                    ? 'border-destructive ring-2 ring-destructive/40'
                                    : 'border-zinc-800'
                                }`}
                              />
                              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                                KG
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5">
                              <span className="sr-only">
                                Reps for set {index + 1}
                              </span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={entry.reps}
                                disabled={entry.done}
                                onChange={(e) =>
                                  updateEntry(index, {
                                    reps: e.target.value,
                                    missReps: false,
                                  })
                                }
                                className={`h-11 w-16 rounded-xl border bg-zinc-950/70 px-3 text-center text-sm font-semibold tabular-nums text-white outline-none transition placeholder:text-zinc-600 focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60 ${
                                  entry.missReps
                                    ? 'border-destructive ring-2 ring-destructive/40'
                                    : 'border-zinc-800'
                                }`}
                              />
                              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                                REPS
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={() => toggleSet(index)}
                              aria-pressed={entry.done}
                              aria-label={
                                entry.done
                                  ? `Set ${index + 1} completed — tap to undo`
                                  : `Mark set ${index + 1} complete`
                              }
                              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${
                                entry.done
                                  ? 'border-success bg-success text-background'
                                  : 'border-silver/20 bg-zinc-950/60 text-zinc-500 hover:border-gold/40 hover:text-gold'
                              }`}
                            >
                              <Check className="size-5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Finish exercise — always tappable; unchecked sets get skipped */}
                {uncheckedCount > 0 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {uncheckedCount} unchecked{' '}
                    {uncheckedCount === 1 ? 'set' : 'sets'} will be marked as
                    skipped.
                  </p>
                )}
                <button
                  type="button"
                  onClick={finishExercise}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold tracking-[0.18em] text-primary-foreground transition-all hover:scale-[1.01] hover:bg-primary/90"
                >
                  FINISH EXERCISE
                  {isLastExercise ? (
                    <Flag className="size-4" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                </button>
              </motion.section>
            </AnimatePresence>
          </>
        )}

        {/* ================= ALL EXERCISES DONE ================= */}
        {stage === 'done' && (
          <motion.section
            className="mt-10 text-center"
            initial={{ opacity: 0, y: reduce ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-success/50 bg-success/15 text-success">
              <Check className="size-8" aria-hidden="true" />
            </div>
            <h1 className="font-heading mt-5 text-2xl font-bold text-white sm:text-3xl">
              All exercises complete
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              The timer is still running — finish the session to stop it and see
              your summary.
            </p>
            <button
              type="button"
              onClick={finishSession}
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-10 text-sm font-bold tracking-[0.18em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90"
            >
              <Flag className="size-4" aria-hidden="true" />
              FINISH SESSION
            </button>
          </motion.section>
        )}

        {/* ================= SUMMARY ================= */}
        {stage === 'summary' && (
          <motion.section
            initial={{ opacity: 0, y: reduce ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
              SESSION COMPLETE
            </p>
            <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-white md:text-4xl">
              {day.focus} · {split.name}
            </h1>

            {/* Totals */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'TOTAL TIME',
                  value: formatClock(finalSecRef.current),
                  icon: Clock3,
                },
                {
                  label: 'TOTAL VOLUME',
                  value: formatVolume(summary.volumeKg),
                  icon: Weight,
                },
                {
                  label: 'SETS',
                  value:
                    summary.setsSkipped > 0
                      ? `${summary.setsCompleted} completed, ${summary.setsSkipped} skipped`
                      : `${summary.setsCompleted} completed`,
                  icon: Layers,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-silver/10 bg-zinc-900/50 p-4"
                >
                  <stat.icon className="mb-2 size-4 text-gold" aria-hidden="true" />
                  <p className="font-heading text-lg font-bold tabular-nums text-white">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-[0.15em] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* PRs / baseline */}
            <div className="mt-6 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-zinc-900/70 to-zinc-950 p-5">
              <div className="flex items-center gap-2.5">
                <Trophy className="size-4 text-gold" aria-hidden="true" />
                <h2 className="font-heading text-lg font-bold text-white">
                  {isFirstEver ? 'Starting baseline' : 'PRs hit'}
                </h2>
              </div>

              {isFirstEver ? (
                summary.baselines.length > 0 ? (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Baseline set for {summary.baselines.length}{' '}
                      {summary.baselines.length === 1 ? 'exercise' : 'exercises'} —
                      these are your starting numbers, and everything from here is
                      progress.
                    </p>
                    <div className="mt-4 space-y-2">
                      {summary.baselines.map((baseline) => (
                        <div
                          key={baseline.exercise}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-silver/10 bg-zinc-950/50 px-4 py-2.5 text-sm"
                        >
                          <span className="min-w-0 truncate text-zinc-300">
                            {baseline.exercise}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-gold">
                            {baseline.weight} kg × {baseline.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No completed sets this time — your baseline will be set the
                    next time you check off a set.
                  </p>
                )
              ) : summary.prs.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {summary.prs.map((pr) => (
                    <div
                      key={pr.exercise}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-gold/30 bg-gold/[0.08] px-4 py-2.5 text-sm"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Sparkles
                          className="size-3.5 shrink-0 text-gold"
                          aria-hidden="true"
                        />
                        <span className="truncate font-semibold text-white">
                          New PR — {pr.exercise}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-gold">
                        {pr.weight} kg, up from {pr.previousBest} kg
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No PRs this session — showing up is what moves the needle.
                </p>
              )}
            </div>

            {/* Per-exercise breakdown */}
            <div className="mt-6">
              <h2 className="font-heading text-lg font-bold text-white">
                Exercise breakdown
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {loggedExercises.map((logged) => (
                  <article
                    key={logged.name}
                    className="rounded-2xl border border-silver/10 bg-zinc-900/50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Dumbbell
                        className="size-4 shrink-0 text-gold"
                        aria-hidden="true"
                      />
                      <h3 className="min-w-0 truncate font-heading text-base font-semibold text-white">
                        {logged.name}
                      </h3>
                      <span className="ml-auto shrink-0 text-[10px] tracking-[0.12em] text-muted-foreground">
                        {logged.muscle.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {logged.sets.map((set) => (
                        <div
                          key={set.setNumber}
                          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm tabular-nums ${
                            set.completed
                              ? 'text-zinc-300'
                              : 'text-zinc-600 line-through'
                          }`}
                        >
                          <span>Set {set.setNumber}</span>
                          <span>
                            {set.completed
                              ? `${set.weight} kg × ${set.reps}`
                              : 'Skipped'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold tracking-[0.18em] text-primary-foreground transition-all hover:scale-[1.01] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="size-4" aria-hidden="true" />
              {saving ? 'SAVING…' : 'SAVE SESSION'}
            </button>
          </motion.section>
        )}
      </main>
    </div>
  )
}
