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
import { CelebrationBanner } from '@/components/celebration-banner'
import { EASE } from '@/components/reveal'
import {
  finishSessionAction,
  logSetAction,
  startSessionAction,
} from '@/lib/data/session-actions'
import type { SplitDetail } from '@/lib/split-data'
import { formatClock, formatVolume } from '@/lib/session-store'
import {
  displayToKg,
  formatDurationSeconds,
  formatLiftSetDisplay,
  formatWeightKg,
  isCardioCategory,
  type WeightUnit,
} from '@/lib/units'

type PreviousBest = {
  weight: number
  reps: number
  durationSeconds?: number | null
}

type ActiveSessionProps = {
  split: SplitDetail
  displayName: string
  initials: string
  isFirstEver: boolean
  /** Map of lift_type_id → best-ever completed set (weights in kg). */
  previousBests: Record<string, PreviousBest>
  /** Display + input unit; storage remains kg. */
  weightUnit?: WeightUnit
}

type SetEntry = {
  weight: string
  reps: string
  durationMinutes: string
  done: boolean
  skipped: boolean
  missWeight: boolean
  missReps: boolean
  missDuration: boolean
  /** True once the set has been written to lift_logs. */
  saved: boolean
}

type LoggedExercise = {
  name: string
  muscle: string
  liftTypeId: string
  isCardio: boolean
  targetSets: number
  targetReps: string
  sets: Array<{
    setNumber: number
    weight: number
    reps: number
    durationSeconds?: number | null
    completed: boolean
  }>
}

type Stage = 'pick' | 'lift' | 'done' | 'summary'

function makeEntries(count: number): SetEntry[] {
  return Array.from({ length: count }, () => ({
    weight: '',
    reps: '',
    durationMinutes: '',
    done: false,
    skipped: false,
    missWeight: false,
    missReps: false,
    missDuration: false,
    saved: false,
  }))
}

export function ActiveSession({
  split,
  displayName,
  initials,
  isFirstEver,
  previousBests,
  weightUnit = 'kg',
}: ActiveSessionProps) {
  const router = useRouter()
  const reduce = useReducedMotion()

  const [stage, setStage] = useState<Stage>('pick')
  const [dayIndex, setDayIndex] = useState(0)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [entries, setEntries] = useState<SetEntry[]>([])
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [celebrations, setCelebrations] = useState<
    Array<{ id: string; title: string; body: string | null }>
  >([])
  const [starting, setStarting] = useState(false)
  const [persisting, setPersisting] = useState(false)

  const startRef = useRef<number | null>(null)
  const finalSecRef = useRef(0)
  const missTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  /** Keep a sync copy so Finish Session never reads a stale React state snapshot. */
  const loggedExercisesRef = useRef<LoggedExercise[]>([])

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
  const exercise = day?.exercises[exerciseIndex]

  const startSession = async (index: number) => {
    setActionError(null)
    setStarting(true)
    const dayRow = split.schedule[index]
    const result = await startSessionAction({
      splitId: split.slug,
      splitDayId: dayRow.id,
    })
    setStarting(false)

    if (result.error || !result.data) {
      setActionError(result.error ?? 'Could not start the session.')
      return
    }

    setSessionId(result.data.id)
    setDayIndex(index)
    setExerciseIndex(0)
    setEntries(makeEntries(dayRow.exercises[0]?.sets ?? 0))
    loggedExercisesRef.current = []
    setLoggedExercises([])
    startRef.current = Date.now()
    setElapsed(0)
    setStage('lift')
  }

  /**
   * Checkmark only updates local UI state. DB writes happen once on
   * "Finish exercise" so we never race and re-save completed sets as skipped.
   */
  const toggleSet = (index: number) => {
    const entry = entries[index]
    if (!entry || entry.saved) return
    const isCardio = isCardioCategory(exercise?.category)

    if (entry.done) {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, done: false } : e)),
      )
      return
    }

    const missDuration = !(Number.parseFloat(entry.durationMinutes) > 0)
    const missWeight = !(Number.parseFloat(entry.weight) > 0)
    const missReps = !(Number.parseInt(entry.reps, 10) > 0)

    if (isCardio ? missDuration : missWeight || missReps) {
      setEntries((prev) =>
        prev.map((e, i) =>
          i === index
            ? {
                ...e,
                missDuration: isCardio ? missDuration : false,
                missWeight: isCardio ? false : missWeight,
                missReps: isCardio ? false : missReps,
              }
            : e,
        ),
      )
      const existing = missTimersRef.current.get(index)
      if (existing) clearTimeout(existing)
      missTimersRef.current.set(
        index,
        setTimeout(() => {
          setEntries((prev) =>
            prev.map((e, i) =>
              i === index
                ? { ...e, missWeight: false, missReps: false, missDuration: false }
                : e,
            ),
          )
        }, 1400),
      )
      return
    }

    setEntries((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              done: true,
              skipped: false,
              missWeight: false,
              missReps: false,
              missDuration: false,
            }
          : e,
      ),
    )
  }

  const updateEntry = (index: number, patch: Partial<SetEntry>) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    )
  }

  const finishExercise = async () => {
    if (!sessionId || !exercise?.liftTypeId || persisting) return
    setActionError(null)
    setPersisting(true)

    const isCardio = isCardioCategory(exercise.category)
    const nextEntries = entries.map((entry) => ({ ...entry }))
    const persistedSets: LoggedExercise['sets'] = []

    try {
      for (let i = 0; i < nextEntries.length; i += 1) {
        const entry = nextEntries[i]

        if (isCardio) {
          const minutes = Number.parseFloat(entry.durationMinutes)
          const hasDuration = Number.isFinite(minutes) && minutes > 0
          const durationSeconds = hasDuration ? Math.round(minutes * 60) : 0

          if (entry.done) {
            if (!hasDuration) {
              setActionError(`Set ${i + 1} is checked but missing duration.`)
              return
            }
            const result = await logSetAction({
              sessionId,
              liftTypeId: exercise.liftTypeId,
              durationSeconds,
              setNumber: i + 1,
              isSkipped: false,
            })
            if (result.error) {
              setActionError(result.error)
              return
            }
            nextEntries[i] = { ...entry, saved: true, skipped: false }
            persistedSets.push({
              setNumber: i + 1,
              weight: 0,
              reps: 0,
              durationSeconds,
              completed: true,
            })
            continue
          }

          if (!hasDuration) continue

          const result = await logSetAction({
            sessionId,
            liftTypeId: exercise.liftTypeId,
            durationSeconds,
            setNumber: i + 1,
            isSkipped: true,
          })
          if (result.error) {
            setActionError(result.error)
            return
          }
          nextEntries[i] = { ...entry, skipped: true, saved: true }
          persistedSets.push({
            setNumber: i + 1,
            weight: 0,
            reps: 0,
            durationSeconds,
            completed: false,
          })
          continue
        }

        const weight = Number.parseFloat(entry.weight)
        const reps = Number.parseInt(entry.reps, 10)
        const hasValues =
          Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0

        if (entry.done) {
          if (!hasValues) {
            setActionError(`Set ${i + 1} is checked but missing weight or reps.`)
            return
          }
          const weightKg = displayToKg(weight, weightUnit)
          const result = await logSetAction({
            sessionId,
            liftTypeId: exercise.liftTypeId,
            weight: weightKg,
            reps,
            setNumber: i + 1,
            isSkipped: false,
          })
          if (result.error) {
            setActionError(result.error)
            return
          }
          nextEntries[i] = { ...entry, saved: true, skipped: false }
          persistedSets.push({
            setNumber: i + 1,
            weight: weightKg,
            reps,
            completed: true,
          })
          continue
        }

        if (!hasValues) continue

        const weightKg = displayToKg(weight, weightUnit)
        const result = await logSetAction({
          sessionId,
          liftTypeId: exercise.liftTypeId,
          weight: weightKg,
          reps,
          setNumber: i + 1,
          isSkipped: true,
        })
        if (result.error) {
          setActionError(result.error)
          return
        }
        nextEntries[i] = { ...entry, skipped: true, saved: true }
        persistedSets.push({
          setNumber: i + 1,
          weight: weightKg,
          reps,
          completed: false,
        })
      }

      setEntries(nextEntries)

      const logged: LoggedExercise = {
        name: exercise.name,
        muscle: exercise.muscle,
        liftTypeId: exercise.liftTypeId,
        isCardio,
        targetSets: exercise.sets,
        targetReps: exercise.reps,
        sets: persistedSets,
      }
      loggedExercisesRef.current = [...loggedExercisesRef.current, logged]
      setLoggedExercises(loggedExercisesRef.current)

      if (exerciseIndex + 1 < day.exercises.length) {
        setExerciseIndex(exerciseIndex + 1)
        setEntries(makeEntries(day.exercises[exerciseIndex + 1].sets))
      } else {
        setStage('done')
      }
    } finally {
      setPersisting(false)
    }
  }

  const finishSession = async () => {
    if (!sessionId || persisting) return
    setActionError(null)
    setPersisting(true)
    finalSecRef.current =
      startRef.current !== null
        ? Math.floor((Date.now() - startRef.current) / 1000)
        : elapsed

    const exercises = loggedExercisesRef.current
    const prs: Array<{
      liftTypeId: string
      weight: number
      reps: number
    }> = []

    for (const logged of exercises) {
      if (logged.isCardio) continue

      let bestThis: { weight: number; reps: number } | null = null
      for (const set of logged.sets) {
        if (!set.completed) continue
        if (set.weight > 0 && (!bestThis || set.weight > bestThis.weight)) {
          bestThis = { weight: set.weight, reps: set.reps }
        }
      }
      if (!bestThis) continue
      const previous = previousBests[logged.liftTypeId]
      if (!previous || bestThis.weight > previous.weight) {
        prs.push({
          liftTypeId: logged.liftTypeId,
          weight: bestThis.weight,
          reps: bestThis.reps,
        })
      }
    }

    // Totals are computed server-side from lift_logs — don't trust client math.
    const result = await finishSessionAction({
      sessionId,
      durationSeconds: finalSecRef.current,
      prs,
    })

    setPersisting(false)

    if (result.error) {
      setActionError(result.error)
      return
    }

    if ('celebrations' in result && Array.isArray(result.celebrations)) {
      setCelebrations(result.celebrations)
    }

    setStage('summary')
  }

  const summary = useMemo(() => {
    let volumeKg = 0
    let setsCompleted = 0
    let setsSkipped = 0
    const prs: Array<{
      exercise: string
      weight: number
      reps: number
      previousBest: number | null
    }> = []
    const baselines: Array<{ exercise: string; weight: number; reps: number }> =
      []

    for (const logged of loggedExercises) {
      if (logged.isCardio) {
        for (const set of logged.sets) {
          if (!set.completed) setsSkipped += 1
          else setsCompleted += 1
        }
        continue
      }

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
      const previous = previousBests[logged.liftTypeId]
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
    router.push('/dashboard/workout')
    router.refresh()
  }

  const uncheckedCount = entries.filter((e) => !e.done && !e.skipped).length
  const isLastExercise = exerciseIndex === (day?.exercises.length ?? 0) - 1

  return (
    <div className="relative min-h-svh overflow-x-clip pb-24 md:pb-10">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(198,40,40,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} />

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
            <div className="h-1 w-full bg-muted" aria-hidden="true">
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
        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {actionError}
          </div>
        )}

        {stage === 'pick' && (
          <section>
            <Link
              href="/dashboard/workout"
              className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              BACK TO WORKOUT
            </Link>

            <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
              ACTIVE SESSION
            </p>
            <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {split.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick today&apos;s training day — the timer starts as soon as you choose.
            </p>

            {split.schedule.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-silver/20 px-6 py-12 text-center text-sm text-muted-foreground">
                This split has no training days yet.
              </p>
            ) : (
              <div className="mt-8 flex flex-col gap-3">
                {split.schedule.map((scheduleDay, index) => (
                  <button
                    key={scheduleDay.id}
                    type="button"
                    disabled={starting}
                    onClick={() => startSession(index)}
                    className="group flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-silver/10 bg-card/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/[0.05] disabled:opacity-60 sm:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-sm font-bold tabular-nums text-gold">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-heading text-base font-semibold text-foreground sm:text-lg">
                          {scheduleDay.focus}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {scheduleDay.note || 'Training day'} ·{' '}
                          {scheduleDay.exercises.length} exercises
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-gold"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {stage === 'lift' && exercise && (
          <>
            {(() => {
              const isCardio = isCardioCategory(exercise.category)
              return (
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
                <div className="glass-card rounded-2xl border border-silver/10 p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <ExerciseThumb
                      muscle={exercise.muscle}
                      image={exercise.image}
                      name={exercise.name}
                      className="size-20 sm:size-24"
                    />
                    <div className="min-w-0">
                      <h1 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                        {exercise.name}
                      </h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isCardio
                          ? `Log duration · ${exercise.sets} ${exercise.sets === 1 ? 'entry' : 'entries'}`
                          : `Target: ${exercise.sets} sets × ${exercise.reps} reps`}
                      </p>
                      <span className="mt-2 inline-block rounded-full border border-silver/20 bg-background/60 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                        {exercise.muscle.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2.5">
                  {entries.map((entry, index) => {
                    const previous = exercise.liftTypeId
                      ? previousBests[exercise.liftTypeId]
                      : undefined
                    return (
                      <div
                        key={index}
                        className={`rounded-2xl border p-3 transition-all duration-200 sm:p-4 ${
                          entry.done
                            ? 'border-success/40 bg-success/[0.07] opacity-75'
                            : 'border-silver/10 bg-card/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground">
                              Set {index + 1}
                            </p>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              {previous
                                ? isCardio
                                  ? previous.durationSeconds
                                    ? `Previous: ${formatDurationSeconds(previous.durationSeconds)}`
                                    : 'Previous: —'
                                  : `Previous: ${formatWeightKg(previous.weight, weightUnit)} × ${previous.reps}`
                                : 'Previous: —'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCardio ? (
                              <label className="flex items-center gap-1.5">
                                <span className="sr-only">
                                  Duration in minutes for set {index + 1}
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={entry.durationMinutes}
                                  disabled={entry.saved}
                                  onChange={(e) =>
                                    updateEntry(index, {
                                      durationMinutes: e.target.value,
                                      missDuration: false,
                                      done: false,
                                    })
                                  }
                                  className={`h-11 w-24 rounded-xl border bg-background/70 px-3 text-center text-sm font-semibold tabular-nums text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60 ${
                                    entry.missDuration
                                      ? 'border-destructive ring-2 ring-destructive/40'
                                      : 'border-border'
                                  }`}
                                />
                                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                                  MIN
                                </span>
                              </label>
                            ) : (
                              <>
                            <label className="flex items-center gap-1.5">
                              <span className="sr-only">
                                Weight for set {index + 1} in {weightUnit}
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.5"
                                placeholder="0"
                                value={entry.weight}
                                disabled={entry.saved}
                                onChange={(e) =>
                                  updateEntry(index, {
                                    weight: e.target.value,
                                    missWeight: false,
                                    // Editing clears the check so the user re-confirms.
                                    done: false,
                                  })
                                }
                                className={`h-11 w-20 rounded-xl border bg-background/70 px-3 text-center text-sm font-semibold tabular-nums text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60 ${
                                  entry.missWeight
                                    ? 'border-destructive ring-2 ring-destructive/40'
                                    : 'border-border'
                                }`}
                              />
                              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                                {weightUnit.toUpperCase()}
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
                                disabled={entry.saved}
                                onChange={(e) =>
                                  updateEntry(index, {
                                    reps: e.target.value,
                                    missReps: false,
                                    done: false,
                                  })
                                }
                                className={`h-11 w-16 rounded-xl border bg-background/70 px-3 text-center text-sm font-semibold tabular-nums text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60 ${
                                  entry.missReps
                                    ? 'border-destructive ring-2 ring-destructive/40'
                                    : 'border-border'
                                }`}
                              />
                              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                                REPS
                              </span>
                            </label>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleSet(index)}
                              disabled={entry.saved}
                              aria-pressed={entry.done}
                              aria-label={
                                entry.done
                                  ? `Set ${index + 1} completed — tap to undo`
                                  : `Mark set ${index + 1} complete`
                              }
                              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 disabled:cursor-default ${
                                entry.done
                                  ? 'border-success bg-success text-background'
                                  : 'border-silver/20 bg-background/60 text-muted-foreground hover:border-gold/40 hover:text-gold'
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

                {uncheckedCount > 0 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {uncheckedCount} unchecked{' '}
                    {uncheckedCount === 1 ? 'set' : 'sets'} with{' '}
                    {isCardio ? 'duration' : 'values'} will be marked skipped;
                    empty {isCardio ? 'entries' : 'sets'} won&apos;t be saved.
                  </p>
                )}
                <button
                  type="button"
                  onClick={finishExercise}
                  disabled={persisting}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold tracking-[0.18em] text-primary-foreground transition-all hover:scale-[1.01] hover:bg-primary/90 disabled:opacity-60"
                >
                  {persisting ? 'SAVING…' : 'FINISH EXERCISE'}
                  {!persisting &&
                    (isLastExercise ? (
                      <Flag className="size-4" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    ))}
                </button>
              </motion.section>
            </AnimatePresence>
                </>
              )
            })()}
          </>
        )}

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
            <h1 className="font-heading mt-5 text-2xl font-bold text-foreground sm:text-3xl">
              All exercises complete
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Finish the session to stop the timer, lock in volume, and check for
              PRs.
            </p>
            <button
              type="button"
              onClick={finishSession}
              disabled={persisting}
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-10 text-sm font-bold tracking-[0.18em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 disabled:opacity-60"
            >
              <Flag className="size-4" aria-hidden="true" />
              {persisting ? 'SAVING…' : 'FINISH SESSION'}
            </button>
          </motion.section>
        )}

        {stage === 'summary' && (
          <motion.section
            initial={{ opacity: 0, y: reduce ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
              SESSION COMPLETE
            </p>
            <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {day.focus} · {split.name}
            </h1>

            {celebrations.length > 0 && (
              <div className="mt-4">
                <CelebrationBanner items={celebrations} />
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'TOTAL TIME',
                  value: formatClock(finalSecRef.current),
                  icon: Clock3,
                },
                {
                  label: 'TOTAL VOLUME',
                  value: formatVolume(summary.volumeKg, weightUnit),
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
                  className="rounded-2xl border border-silver/10 bg-card/50 p-4"
                >
                  <stat.icon className="mb-2 size-4 text-gold" aria-hidden="true" />
                  <p className="font-heading text-lg font-bold tabular-nums text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-[0.15em] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-card/70 to-background p-5">
              <div className="flex items-center gap-2.5">
                <Trophy className="size-4 text-gold" aria-hidden="true" />
                <h2 className="font-heading text-lg font-bold text-foreground">
                  {isFirstEver ? 'Starting baseline' : 'PRs hit'}
                </h2>
              </div>

              {isFirstEver ? (
                summary.baselines.length > 0 ? (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Baseline set for {summary.baselines.length}{' '}
                      {summary.baselines.length === 1 ? 'exercise' : 'exercises'} —
                      these are your starting numbers.
                    </p>
                    <div className="mt-4 space-y-2">
                      {summary.baselines.map((baseline) => (
                        <div
                          key={baseline.exercise}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-silver/10 bg-background/50 px-4 py-2.5 text-sm"
                        >
                          <span className="min-w-0 truncate text-muted-foreground">
                            {baseline.exercise}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-gold">
                            {formatWeightKg(baseline.weight, weightUnit)} ×{' '}
                            {baseline.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No completed sets this time — your baseline will be set next
                    time you check off a set.
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
                        <span className="truncate font-semibold text-foreground">
                          New PR — {pr.exercise}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-gold">
                        {formatWeightKg(pr.weight, weightUnit)}
                        {pr.previousBest != null
                          ? `, up from ${formatWeightKg(pr.previousBest, weightUnit)}`
                          : ''}
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

            <div className="mt-6">
              <h2 className="font-heading text-lg font-bold text-foreground">
                Exercise breakdown
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {loggedExercises.map((logged) => (
                  <article
                    key={logged.liftTypeId + logged.name}
                    className="rounded-2xl border border-silver/10 bg-card/50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Dumbbell
                        className="size-4 shrink-0 text-gold"
                        aria-hidden="true"
                      />
                      <h3 className="min-w-0 truncate font-heading text-base font-semibold text-foreground">
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
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground line-through'
                          }`}
                        >
                          <span>Set {set.setNumber}</span>
                          <span>
                            {set.completed
                              ? formatLiftSetDisplay({
                                  weightKg: set.weight,
                                  reps: set.reps,
                                  durationSeconds: set.durationSeconds,
                                  weightUnit,
                                  isCardio: logged.isCardio,
                                })
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
