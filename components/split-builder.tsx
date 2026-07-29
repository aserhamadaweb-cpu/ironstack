'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  GripVertical,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
  useReducedMotion,
} from 'framer-motion'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExerciseCard } from '@/components/exercise-card'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { FloatingActions } from '@/components/floating-actions'
import { EASE } from '@/components/reveal'
import { MUSCLE_FILTERS, type LibraryExercise } from '@/lib/exercise-library'

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type SetType = 'normal' | 'warmup' | 'failure'

type BuilderExercise = {
  uid: string
  exercise: LibraryExercise
  sets: number
  reps: string
  setType: SetType
}

type BuilderDay = {
  id: string
  name: string
  exercises: BuilderExercise[]
}

const STEPS = ['BASICS', 'DAYS', 'BUILD', 'SAVE'] as const

const SET_TYPES: { id: SetType; label: string; active: string }[] = [
  { id: 'normal', label: 'NORMAL', active: 'border-silver/50 bg-silver/15 text-silver' },
  { id: 'warmup', label: 'WARM-UP', active: 'border-gold/50 bg-gold/15 text-gold' },
  { id: 'failure', label: 'FAILURE', active: 'border-destructive/60 bg-destructive/15 text-destructive' },
]

const MAX_LIBRARY_RESULTS = 60

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

type SplitBuilderProps = {
  library: LibraryExercise[]
  displayName: string
  initials: string
}

export function SplitBuilder({ library, displayName, initials }: SplitBuilderProps) {
  const reduce = useReducedMotion()
  const uidRef = useRef(0)

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [splitName, setSplitName] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [days, setDays] = useState<BuilderDay[]>(() =>
    Array.from({ length: 3 }, (_, i) => ({
      id: `day-${i}`,
      name: `Day ${i + 1}`,
      exercises: [],
    }))
  )
  const [activeDay, setActiveDay] = useState(0)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const totalExercises = days.reduce((sum, day) => sum + day.exercises.length, 0)

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  /** Resize the days array, keeping existing names/exercises where possible. */
  const applyDayCount = (count: number) => {
    setDaysPerWeek(count)
    setDays((current) =>
      Array.from({ length: count }, (_, i) =>
        current[i] ?? { id: `day-${i}`, name: `Day ${i + 1}`, exercises: [] }
      )
    )
    setActiveDay((current) => Math.min(current, count - 1))
  }

  const renameDay = (index: number, name: string) => {
    setDays((current) =>
      current.map((day, i) => (i === index ? { ...day, name } : day))
    )
  }

  const addExercise = (exercise: LibraryExercise) => {
    uidRef.current += 1
    const entry: BuilderExercise = {
      uid: `ex-${uidRef.current}`,
      exercise,
      sets: 3,
      reps: '8–12',
      setType: 'normal',
    }
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay ? { ...day, exercises: [...day.exercises, entry] } : day
      )
    )
  }

  const updateExercise = (uid: string, patch: Partial<BuilderExercise>) => {
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.uid === uid ? { ...ex, ...patch } : ex
              ),
            }
          : day
      )
    )
  }

  const removeExercise = (uid: string) => {
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay
          ? { ...day, exercises: day.exercises.filter((ex) => ex.uid !== uid) }
          : day
      )
    )
  }

  const reorderExercises = (next: BuilderExercise[]) => {
    setDays((current) =>
      current.map((day, i) => (i === activeDay ? { ...day, exercises: next } : day))
    )
  }

  const stepVariants = {
    enter: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * 48 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * -48 }),
  }

  const canLeaveBasics = splitName.trim().length > 0
  const canSave = totalExercises > 0

  return (
    <div className="relative min-h-svh overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(234,179,8,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} />

      <main className="mx-auto max-w-3xl px-6 pt-8 pb-24 md:pt-12">
        <Link
          href="/dashboard/workout"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-zinc-400 transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          BACK TO WORKOUT
        </Link>

        <div className="mb-8">
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">CUSTOM</p>
          <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Create Your Own Split
          </h1>
        </div>

        {/* ---- Progress indicator ---- */}
        <div className="mb-10">
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-gold"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => i < step && goTo(i)}
                disabled={i > step}
                className={`flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] transition-colors ${
                  i === step
                    ? 'text-gold'
                    : i < step
                      ? 'text-zinc-300 hover:text-gold'
                      : 'text-zinc-600'
                }`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full border text-[10px] tabular-nums ${
                    i === step
                      ? 'border-gold/60 bg-gold/15 text-gold'
                      : i < step
                        ? 'border-gold/40 bg-primary text-primary-foreground'
                        : 'border-zinc-700 text-zinc-600'
                  }`}
                >
                  {i < step ? <Check className="size-3" aria-hidden="true" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Steps ---- */}
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
          >
            {step === 0 && (
              <section className="glass-card rounded-2xl border border-silver/10 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-bold text-white">Split basics</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Name your split and pick how many days a week you train.
                </p>

                <label className="mt-6 block">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
                    SPLIT NAME
                  </span>
                  <input
                    type="text"
                    value={splitName}
                    onChange={(e) => setSplitName(e.target.value)}
                    placeholder="My Custom Split"
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>

                <div className="mt-6">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
                    DAYS PER WEEK
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => applyDayCount(n)}
                        aria-pressed={daysPerWeek === n}
                        className={`flex size-11 items-center justify-center rounded-full border text-sm font-bold tabular-nums transition-all duration-200 ${
                          daysPerWeek === n
                            ? 'border-gold/60 bg-primary text-primary-foreground'
                            : 'border-silver/20 bg-zinc-900/60 text-zinc-400 hover:border-gold/40 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    disabled={!canLeaveBasics}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    NEXT
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="glass-card rounded-2xl border border-silver/10 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-bold text-white">Name each day</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Give each training day a name — e.g. Push, Pull, Upper, Leg Day.
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  {days.map((day, index) => (
                    <label key={day.id} className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-xs font-bold tabular-nums text-gold">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={day.name}
                        onChange={(e) => renameDay(index, e.target.value)}
                        placeholder={`Day ${index + 1}`}
                        className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goTo(0)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-silver/20 px-6 text-sm font-semibold tracking-[0.15em] text-zinc-300 transition-colors hover:border-silver/40 hover:text-white"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90"
                  >
                    NEXT
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                {/* Day tabs */}
                <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                  {days.map((day, index) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setActiveDay(index)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.1em] transition-all ${
                        index === activeDay
                          ? 'border-gold/60 bg-gold/15 text-gold'
                          : 'border-silver/15 bg-zinc-900/50 text-zinc-400 hover:border-gold/30 hover:text-white'
                      }`}
                    >
                      {day.name || `Day ${index + 1}`}
                      <span className="ml-2 text-[10px] tabular-nums text-zinc-500">
                        {day.exercises.length}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="group mb-5 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold/35 bg-zinc-900/30 px-6 py-6 transition-all duration-200 hover:border-gold/60 hover:bg-gold/5"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition-transform duration-200 group-hover:scale-110">
                    <Plus className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-heading text-lg font-bold text-white">
                    Add Exercise
                  </span>
                </button>

                {days[activeDay].exercises.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-silver/20 bg-zinc-900/35 px-6 py-12 text-center">
                    <p className="font-heading text-lg font-semibold text-white">
                      Nothing here yet
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
                      Tap “Add Exercise” to open the library and start building{' '}
                      {days[activeDay].name || `Day ${activeDay + 1}`}.
                    </p>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={days[activeDay].exercises}
                    onReorder={reorderExercises}
                    className="flex flex-col gap-2.5"
                  >
                    {days[activeDay].exercises.map((entry, index) => (
                      <ExerciseRow
                        key={entry.uid}
                        entry={entry}
                        index={index}
                        onUpdate={updateExercise}
                        onRemove={removeExercise}
                      />
                    ))}
                  </Reorder.Group>
                )}

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-silver/20 px-6 text-sm font-semibold tracking-[0.15em] text-zinc-300 transition-colors hover:border-silver/40 hover:text-white"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(3)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90"
                  >
                    REVIEW
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="glass-card rounded-2xl border border-silver/10 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-bold text-white">
                  Review &amp; save
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Everything look right? Save it to Your Splits and start training.
                </p>

                <div className="mt-6 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-zinc-900/70 to-zinc-950 p-5">
                  <p className="font-heading text-2xl font-bold text-white">
                    {splitName.trim() || 'My Custom Split'}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {daysPerWeek} days / week · {totalExercises} exercises
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    {days.map((day, index) => (
                      <div
                        key={day.id}
                        className="flex items-center justify-between rounded-xl border border-silver/10 bg-zinc-950/50 px-4 py-2.5"
                      >
                        <span className="text-sm font-semibold text-white">
                          {day.name || `Day ${index + 1}`}
                        </span>
                        <span className="text-xs tabular-nums text-zinc-500">
                          {day.exercises.length} exercises
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {!canSave && (
                  <p className="mt-4 text-xs text-zinc-500">
                    Add at least one exercise before saving.
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-silver/20 px-6 text-sm font-semibold tracking-[0.15em] text-zinc-300 transition-colors hover:border-silver/40 hover:text-white"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    BACK
                  </button>

                  <motion.button
                    type="button"
                    onClick={() => canSave && setSaved(true)}
                    disabled={!canSave}
                    aria-live="polite"
                    className={`relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-10 text-sm font-bold tracking-[0.18em] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                      saved ? 'bg-success text-background' : 'bg-primary text-primary-foreground hover:bg-primary/90'
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
                          SAVE SPLIT
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>

                {saved && (
                  <motion.div
                    className="mt-6 text-center"
                    initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
                  >
                    <Link
                      href="/dashboard/workout"
                      className="text-xs font-semibold tracking-[0.15em] text-gold transition-opacity hover:opacity-80"
                    >
                      BACK TO YOUR SPLITS →
                    </Link>
                  </motion.div>
                )}
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {libraryOpen && (
          <ExerciseLibrary
            library={library}
            dayName={days[activeDay].name || `Day ${activeDay + 1}`}
            addedCount={days[activeDay].exercises.length}
            onAdd={addExercise}
            onClose={() => setLibraryOpen(false)}
          />
        )}
      </AnimatePresence>

      <FloatingActions />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise row (step 3)                                               */
/* ------------------------------------------------------------------ */

function ExerciseRow({
  entry,
  index,
  onUpdate,
  onRemove,
}: {
  entry: BuilderExercise
  index: number
  onUpdate: (uid: string, patch: Partial<BuilderExercise>) => void
  onRemove: (uid: string) => void
}) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      className="group rounded-2xl border border-silver/10 bg-zinc-900/60 p-3 transition-colors hover:border-silver/25 sm:p-4"
    >
      <ExerciseCard
        index={index}
        name={entry.exercise.name}
        muscles={entry.exercise.muscles}
        image={entry.exercise.image}
        leading={
          <button
            type="button"
            aria-label="Drag to reorder"
            onPointerDown={(e) => controls.start(e)}
            className="shrink-0 cursor-grab touch-none text-zinc-600 transition-colors hover:text-zinc-300 active:cursor-grabbing"
          >
            <GripVertical className="size-5" aria-hidden="true" />
          </button>
        }
        trailing={
          <button
            type="button"
            onClick={() => onRemove(entry.uid)}
            aria-label={`Remove ${entry.exercise.name}`}
            className="shrink-0 rounded-lg p-2 text-zinc-600 transition-colors hover:bg-red-600/15 hover:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        }
      >
        {/* Sets / reps / set type controls */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 pl-8 sm:pl-9">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            SETS
          </span>
          <div className="flex items-center rounded-full border border-silver/15 bg-zinc-950/60">
            <button
              type="button"
              aria-label="Fewer sets"
              onClick={() => onUpdate(entry.uid, { sets: Math.max(1, entry.sets - 1) })}
              className="p-1.5 text-zinc-500 transition-colors hover:text-white"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span className="w-6 text-center text-sm font-bold tabular-nums text-white">
              {entry.sets}
            </span>
            <button
              type="button"
              aria-label="More sets"
              onClick={() => onUpdate(entry.uid, { sets: Math.min(10, entry.sets + 1) })}
              className="p-1.5 text-zinc-500 transition-colors hover:text-white"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            REPS
          </span>
          <input
            type="text"
            value={entry.reps}
            onChange={(e) => onUpdate(entry.uid, { reps: e.target.value })}
            className="h-8 w-20 rounded-full border border-silver/15 bg-zinc-950/60 px-3 text-center text-sm font-semibold text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/25"
          />
        </label>

        <div className="flex items-center gap-1.5">
          {SET_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onUpdate(entry.uid, { setType: type.id })}
              aria-pressed={entry.setType === type.id}
              className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                entry.setType === type.id
                  ? type.active
                  : 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      </ExerciseCard>
    </Reorder.Item>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise Library modal                                              */
/* ------------------------------------------------------------------ */

function ExerciseLibrary({
  library,
  dayName,
  addedCount,
  onAdd,
  onClose,
}: {
  library: LibraryExercise[]
  dayName: string
  addedCount: number
  onAdd: (exercise: LibraryExercise) => void
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [activeMuscles, setActiveMuscles] = useState<string[]>([])
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library.filter((exercise) => {
      if (q && !exercise.name.toLowerCase().includes(q)) return false
      if (
        activeMuscles.length &&
        !exercise.muscles.some((muscle) => activeMuscles.includes(muscle))
      )
        return false
      return true
    })
  }, [library, query, activeMuscles])

  const visible = filtered.slice(0, MAX_LIBRARY_RESULTS)

  const toggleMuscle = (muscle: string) => {
    setActiveMuscles((current) =>
      current.includes(muscle)
        ? current.filter((m) => m !== muscle)
        : [...current, muscle]
    )
  }

  const handleAdd = (exercise: LibraryExercise) => {
    onAdd(exercise)
    setLastAdded(exercise.id)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Exercise Library"
        className="flex h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-silver/15 bg-zinc-950 shadow-2xl sm:h-[85svh] sm:rounded-3xl"
        initial={{ y: reduce ? 0 : 64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduce ? 0 : 64, opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-silver/10 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.25em] text-gold">
                EXERCISE LIBRARY
              </p>
              <h2 className="font-heading mt-0.5 text-lg font-bold text-white">
                Adding to {dayName}
                <span className="ml-2 text-xs font-semibold text-zinc-500">
                  {addedCount} added
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close library"
              className="rounded-full border border-silver/20 p-2 text-zinc-400 transition-colors hover:border-silver/40 hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search
              className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 800+ exercises…"
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pr-4 pl-10 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {MUSCLE_FILTERS.map((muscle) => {
              const active = activeMuscles.includes(muscle)
              return (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] transition-all ${
                    active
                      ? 'border-gold/60 bg-gold/15 text-gold'
                      : 'border-silver/15 bg-zinc-900/60 text-zinc-400 hover:border-gold/30 hover:text-white'
                  }`}
                >
                  {muscle.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {visible.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              No exercises match — try a different search or clear the filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visible.map((exercise) => {
                const justAdded = lastAdded === exercise.id
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleAdd(exercise)}
                    className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 ${
                      justAdded
                        ? 'border-gold/60 shadow-[0_0_22px_-8px_rgba(234,179,8,0.5)]'
                        : 'border-silver/10 bg-zinc-900/50 hover:border-gold/35'
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                      <ExerciseThumb
                        muscle={exercise.muscles[0] ?? 'Core'}
                        image={exercise.image}
                        name={exercise.name}
                        className="absolute inset-0 !size-full rounded-none border-0"
                      />
                      {justAdded && (
                        <motion.div
                          className="absolute inset-0 flex items-center justify-center bg-gold/25"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-5" aria-hidden="true" />
                          </span>
                        </motion.div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-white">
                        {exercise.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {exercise.muscles.slice(0, 2).map((muscle) => (
                          <span
                            key={muscle}
                            className="rounded-full border border-silver/20 bg-zinc-950/60 px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-zinc-400"
                          >
                            {muscle.toUpperCase()}
                          </span>
                        ))}
                        <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-gold/90">
                          {exercise.equipment.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {filtered.length > MAX_LIBRARY_RESULTS && (
            <p className="mt-4 text-center text-xs text-zinc-500">
              Showing {MAX_LIBRARY_RESULTS} of {filtered.length} — refine your search to
              see more.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-silver/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.01] hover:bg-primary/90"
          >
            DONE — BACK TO {dayName.toUpperCase()}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
