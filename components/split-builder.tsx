'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  GripVertical,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
  useReducedMotion,
} from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExerciseCard } from '@/components/exercise-card'
import { ExerciseLibraryOverlay } from '@/components/exercise-library-overlay'
import { EASE } from '@/components/reveal'
import { saveCustomSplit, updateCustomSplit } from '@/lib/data/save-split'
import { isNetworkFailure } from '@/lib/log'
import { saveSplitOffline } from '@/lib/offline/split-store'
import { queueSplitSync } from '@/lib/offline/sync'
import type { LibraryExercise } from '@/lib/exercise-library'
import { isCardioCategory } from '@/lib/units'

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
  subtitle?: string | null
  exercises: BuilderExercise[]
}

export type SplitBuilderInitial = {
  name: string
  description?: string | null
  daysPerWeek: number
  days: BuilderDay[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STEP_KEYS = ['stepBasics', 'stepDays', 'stepBuild', 'stepSave'] as const

const SET_TYPE_KEYS: {
  id: SetType
  labelKey: 'setNormal' | 'setWarmup' | 'setFailure'
  active: string
}[] = [
  {
    id: 'normal',
    labelKey: 'setNormal',
    active: 'border-silver/50 bg-silver/15 text-silver',
  },
  {
    id: 'warmup',
    labelKey: 'setWarmup',
    active: 'border-gold/50 bg-gold/15 text-gold',
  },
  {
    id: 'failure',
    labelKey: 'setFailure',
    active: 'border-destructive/60 bg-destructive/15 text-destructive',
  },
]

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

type SplitBuilderProps = {
  library: LibraryExercise[]
  displayName: string
  initials: string
  avatarUrl?: string | null
  customSplitCount?: number
  maxCustomSplits?: number
  mode?: 'create' | 'edit'
  editSplitId?: string
  initial?: SplitBuilderInitial
  defaultHomeLibrary?: boolean
  /** From onboarding “create yourself” — start tour after first save. */
  startTourAfterSave?: boolean
}

export function SplitBuilder({
  library,
  displayName,
  initials,
  avatarUrl,
  customSplitCount = 0,
  maxCustomSplits = 3,
  mode = 'create',
  editSplitId,
  initial,
  defaultHomeLibrary = false,
  startTourAfterSave = false,
}: SplitBuilderProps) {
  const t = useTranslations('splitBuilder')
  const tOffline = useTranslations('offline')
  const locale = useLocale()
  const isRtl = locale === 'ar'
  const router = useRouter()
  const reduce = useReducedMotion()
  const uidRef = useRef(0)
  const isEdit = mode === 'edit' && Boolean(editSplitId)

  const dayLabel = (n: number) => t('dayFallback', { n })

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [splitName, setSplitName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [daysPerWeek, setDaysPerWeek] = useState(initial?.daysPerWeek ?? 3)
  const [days, setDays] = useState<BuilderDay[]>(() => {
    if (initial?.days?.length) {
      return initial.days.map((day, i) => ({
        ...day,
        id: day.id || `day-${i}`,
        exercises: day.exercises.map((ex, j) => {
          uidRef.current = Math.max(uidRef.current, j + 1)
          return { ...ex, uid: ex.uid || `ex-${i}-${j}` }
        }),
      }))
    }
    return Array.from({ length: 3 }, (_, i) => ({
      id: `day-${i}`,
      name: '',
      subtitle: null,
      exercises: [],
    }))
  })
  const [activeDay, setActiveDay] = useState(0)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedSplitId, setSavedSplitId] = useState<string | null>(
    editSplitId ?? null,
  )
  const [draftReady, setDraftReady] = useState(false)
  const savingRef = useRef(false)
  const createIdRef = useRef<string | null>(null)

  const draftKey =
    isEdit && editSplitId
      ? `ironstack.split-builder.draft.edit.${editSplitId}`
      : 'ironstack.split-builder.draft.create'

  const initialFingerprint = JSON.stringify(
    (initial?.days ?? []).map((day) =>
      day.exercises.map((entry) => entry.exercise.id),
    ),
  )

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw) as {
          step?: number
          activeDay?: number
          splitName?: string
          description?: string
          daysPerWeek?: number
          days?: BuilderDay[]
          baseFingerprint?: string
        }
        const draftIsCurrent =
          !isEdit ||
          !draft.baseFingerprint ||
          draft.baseFingerprint === initialFingerprint
        if (draftIsCurrent && Array.isArray(draft.days) && draft.days.length > 0) {
          if (typeof draft.splitName === 'string') setSplitName(draft.splitName)
          if (typeof draft.description === 'string') setDescription(draft.description)
          if (typeof draft.daysPerWeek === 'number') setDaysPerWeek(draft.daysPerWeek)
          if (typeof draft.step === 'number') setStep(Math.min(Math.max(draft.step, 0), 3))
          if (typeof draft.activeDay === 'number') {
            setActiveDay(Math.min(Math.max(draft.activeDay, 0), draft.days.length - 1))
          }
          setDays(draft.days)
          for (const day of draft.days) {
            for (const entry of day.exercises) {
              const numeric = Number(String(entry.uid).replace(/\D/g, ''))
              if (Number.isFinite(numeric)) {
                uidRef.current = Math.max(uidRef.current, numeric)
              }
            }
          }
        }
      }
    } catch {
      /* ignore malformed drafts */
    }
    setDraftReady(true)
  }, [draftKey, initialFingerprint, isEdit])

  useEffect(() => {
    if (!draftReady || saved) return
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          step,
          activeDay,
          splitName,
          description,
          daysPerWeek,
          days,
          updatedAt: Date.now(),
          baseFingerprint: initialFingerprint,
        }),
      )
    } catch {
      /* quota / private mode */
    }
  }, [
    draftReady,
    saved,
    draftKey,
    step,
    activeDay,
    splitName,
    description,
    daysPerWeek,
    days,
    initialFingerprint,
  ])

  useEffect(() => {
    setSaved(false)
  }, [splitName, description, daysPerWeek, days])

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
        current[i] ?? {
          id: `day-${i}`,
          name: '',
          subtitle: null,
          exercises: [],
        },
      ),
    )
    setActiveDay((current) => Math.min(current, count - 1))
  }

  const renameDay = (index: number, name: string) => {
    setDays((current) =>
      current.map((day, i) => (i === index ? { ...day, name } : day)),
    )
  }

  const addExercise = (exercise: LibraryExercise) => {
    uidRef.current += 1
    const isCardio = isCardioCategory(exercise.category)
    const entry: BuilderExercise = {
      uid: `ex-${uidRef.current}`,
      exercise,
      sets: isCardio ? 1 : 3,
      reps: isCardio ? '30' : '8–12',
      setType: 'normal',
    }
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay
          ? { ...day, exercises: [...day.exercises, entry] }
          : day,
      ),
    )
  }

  const updateExercise = (uid: string, patch: Partial<BuilderExercise>) => {
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay
          ? {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.uid === uid ? { ...ex, ...patch } : ex,
              ),
            }
          : day,
      ),
    )
  }

  const removeExercise = (uid: string) => {
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay
          ? {
              ...day,
              exercises: day.exercises.filter((ex) => ex.uid !== uid),
            }
          : day,
      ),
    )
  }

  const reorderExercises = (next: BuilderExercise[]) => {
    setDays((current) =>
      current.map((day, i) =>
        i === activeDay ? { ...day, exercises: next } : day,
      ),
    )
  }

  const animDir = isRtl ? -direction : direction
  const stepVariants = {
    enter: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * 48 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * -48 }),
  }

  const canLeaveBasics = splitName.trim().length > 0
  const canSave = totalExercises > 0 && !saving && !(saved && !isEdit)
  const atCreateCap = !isEdit && customSplitCount >= maxCustomSplits

  const handleSave = async () => {
    if (!canSave || savingRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSaveError(tOffline('splitRequiresConnection'))
      return
    }
    if (atCreateCap) {
      setSaveError(t('limitReached', { max: maxCustomSplits }))
      return
    }
    setSaveError(null)
    setSaving(true)
    savingRef.current = true

    const splitId =
      (isEdit && editSplitId) ||
      savedSplitId ||
      createIdRef.current ||
      crypto.randomUUID()
    createIdRef.current = splitId
    const dayIds = days.map((day) =>
      UUID_RE.test(day.id) ? day.id : crypto.randomUUID(),
    )
    const payload = {
      id: splitId,
      dayIds,
      name: splitName.trim(),
      description:
        description.trim() ||
        t('defaultDescription', { days: daysPerWeek }),
      category: 'Hypertrophy',
      daysPerWeek,
      days: days.map((day, index) => ({
        name: day.name.trim() || dayLabel(index + 1),
        subtitle: day.subtitle?.trim() || null,
        exercises: day.exercises.map((entry) => ({
          libraryId: entry.exercise.legacySlug || entry.exercise.id,
          name: entry.exercise.name,
          muscles: entry.exercise.muscles,
          image: entry.exercise.image,
          sets: entry.sets,
          reps: entry.reps,
          category: entry.exercise.category,
          equipment: entry.exercise.equipment,
        })),
      })),
    }

    try {
      const local = await saveSplitOffline({
        kind: isEdit && editSplitId ? 'update' : 'create',
        splitId,
        payload,
        sync: false,
      })
      if (local.error || !local.data) {
        setSaveError(local.error ?? t('saveFailed'))
        return
      }

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const remote =
          isEdit && editSplitId
            ? await updateCustomSplit(editSplitId, payload)
            : await saveCustomSplit(payload)
        if (remote.error) {
          queueSplitSync()
          setSavedSplitId(splitId)
          setSaveError(remote.error)
          return
        }
      }

      queueSplitSync()
      setSavedSplitId(splitId)
      setSaved(true)
      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        /* ignore */
      }
      if (startTourAfterSave && !isEdit) {
        window.location.assign('/dashboard/home?tour=1')
        return
      }
      router.refresh()
    } catch (err) {
      if (isNetworkFailure(err)) {
        queueSplitSync()
        setSavedSplitId(splitId)
        setSaved(true)
        if (startTourAfterSave && !isEdit) {
          window.location.assign('/dashboard/home?tour=1')
          return
        }
      } else {
        setSaveError(err instanceof Error ? err.message : t('saveFailed'))
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const activeDayName =
    days[activeDay]?.name.trim() || dayLabel(activeDay + 1)

  return (
    <div className="relative min-h-svh overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(198,40,40,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -end-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] start-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} avatarUrl={avatarUrl} />

      <main className="mx-auto max-w-3xl px-6 pt-8 md:pt-12">
        <Link
          href={
            isEdit && editSplitId
              ? `/dashboard/splits/${editSplitId}`
              : '/dashboard/workout'
          }
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
          {isEdit ? t('backToSplit') : t('backToWorkout')}
        </Link>

        <div className="mb-8">
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
            {isEdit ? t('kickerEdit') : t('kickerCustom')}
          </p>
          <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {isEdit ? t('titleEdit') : t('titleCreate')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isEdit
              ? t('subtitleEdit')
              : t('subtitleCreate', {
                  count: library.length,
                  used: customSplitCount,
                  max: maxCustomSplits,
                })}
          </p>
        </div>

        <div className="mb-10">
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gold"
              animate={{ width: `${((step + 1) / STEP_KEYS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>
          <div className="flex items-center justify-between">
            {STEP_KEYS.map((labelKey, i) => (
              <button
                key={labelKey}
                type="button"
                onClick={() => i < step && goTo(i)}
                disabled={i > step}
                className={`flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] transition-colors ${
                  i === step
                    ? 'text-gold'
                    : i < step
                      ? 'text-muted-foreground hover:text-gold'
                      : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full border text-[10px] tabular-nums ${
                    i === step
                      ? 'border-gold/60 bg-gold/15 text-gold'
                      : i < step
                        ? 'border-gold/40 bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {i < step ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="hidden sm:inline">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" custom={animDir} initial={false}>
          <motion.div
            key={step}
            custom={animDir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
          >
            {step === 0 && (
              <section className="glass-card rounded-2xl border border-silver/10 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-bold text-foreground">
                  {t('basicsTitle')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('basicsBody')}
                </p>

                <label className="mt-6 block">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                    {t('splitName')}
                  </span>
                  <input
                    type="text"
                    value={splitName}
                    onChange={(e) => setSplitName(e.target.value)}
                    placeholder={t('splitNamePlaceholder')}
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>

                <label className="mt-6 block">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                    {t('description')}
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder={t('descriptionPlaceholder')}
                    className="mt-2 w-full rounded-xl border border-border bg-card/90 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>

                <div className="mt-6">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                    {t('daysPerWeek')}
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
                            : 'border-silver/20 bg-card/60 text-muted-foreground hover:border-gold/40 hover:text-foreground'
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
                    {t('next')}
                    <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="glass-card rounded-2xl border border-silver/10 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-bold text-foreground">
                  {t('nameDaysTitle')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('nameDaysBody')}
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
                        placeholder={dayLabel(index + 1)}
                        className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goTo(0)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-silver/20 px-6 text-sm font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:border-silver/40 hover:text-foreground"
                  >
                    <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
                    {t('back')}
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90"
                  >
                    {t('next')}
                    <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                  {days.map((day, index) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setActiveDay(index)}
                      aria-pressed={index === activeDay}
                      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.1em] transition-all ${
                        index === activeDay
                          ? 'border-gold/60 bg-gold/15 text-gold'
                          : 'border-silver/15 bg-card/50 text-muted-foreground hover:border-gold/30 hover:text-foreground'
                      }`}
                    >
                      {day.name.trim() || dayLabel(index + 1)}
                      <span className="ms-2 text-[10px] tabular-nums text-muted-foreground">
                        {day.exercises.length}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="group mb-5 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold/35 bg-card/30 px-6 py-6 transition-all duration-200 hover:border-gold/60 hover:bg-gold/5"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition-transform duration-200 group-hover:scale-110">
                    <Plus className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-heading text-lg font-bold text-foreground">
                    {t('addExercise')}
                  </span>
                </button>

                {days[activeDay].exercises.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-silver/20 bg-card/35 px-6 py-12 text-center">
                    <p className="font-heading text-lg font-semibold text-foreground">
                      {t('emptyDayTitle')}
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                      {t('emptyDayBody', { day: activeDayName })}
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
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-silver/20 px-6 text-sm font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:border-silver/40 hover:text-foreground"
                  >
                    <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
                    {t('back')}
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(3)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold tracking-[0.15em] text-primary-foreground transition-all hover:scale-[1.02] hover:bg-primary/90"
                  >
                    {t('review')}
                    <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="glass-card rounded-2xl border border-silver/10 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-bold text-foreground">
                  {t('reviewTitle')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('reviewBody')}
                </p>

                <div className="mt-6 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card/70 to-background p-5">
                  <p className="font-heading text-2xl font-bold text-foreground">
                    {splitName.trim() || t('splitNamePlaceholder')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('summaryMeta', {
                      days: daysPerWeek,
                      exercises: totalExercises,
                    })}
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    {days.map((day, index) => (
                      <div
                        key={day.id}
                        className="flex items-center justify-between rounded-xl border border-silver/10 bg-background/50 px-4 py-2.5"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {day.name.trim() || dayLabel(index + 1)}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t('exerciseCount', {
                            count: day.exercises.length,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {!canSave && !saved && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {t('needOneExercise')}
                  </p>
                )}

                {saveError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {saveError}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    disabled={saving}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-silver/20 px-6 text-sm font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:border-silver/40 hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
                    {t('back')}
                  </button>

                  <motion.button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    aria-live="polite"
                    className={`relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-10 text-sm font-bold tracking-[0.18em] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                      saved
                        ? 'bg-success text-background'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                    whileTap={{ scale: 0.97 }}
                    animate={
                      saved && !reduce
                        ? {
                            boxShadow: [
                              '0 0 0 0 rgba(198,40,40,0.6)',
                              '0 0 34px 8px rgba(198,40,40,0.45)',
                              '0 0 0 0 rgba(198,40,40,0)',
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
                          {t('saved')}
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
                          {saving
                            ? t('saving')
                            : isEdit
                              ? t('saveChanges')
                              : t('saveSplit')}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>

                {saved && (
                  <motion.div
                    className="mt-6 flex flex-col items-center gap-3 text-center"
                    initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
                  >
                    <Link
                      href={
                        savedSplitId
                          ? `/dashboard/splits/${savedSplitId}`
                          : '/dashboard/workout'
                      }
                      className="text-xs font-semibold tracking-[0.15em] text-gold transition-opacity hover:opacity-80"
                    >
                      {isEdit ? t('backToThisSplit') : t('backToYourSplits')}
                    </Link>
                    {savedSplitId && !isEdit && (
                      <Link
                        href={`/dashboard/splits/${savedSplitId}`}
                        className="text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
                      >
                        {t('openThisSplit')}
                      </Link>
                    )}
                  </motion.div>
                )}
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {libraryOpen && (
          <ExerciseLibraryOverlay
            library={library}
            dayName={activeDayName}
            addedCount={days[activeDay].exercises.length}
            onAdd={addExercise}
            onClose={() => setLibraryOpen(false)}
            initialHomeOnly={defaultHomeLibrary}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise row                                                        */
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
  const t = useTranslations('splitBuilder')
  const controls = useDragControls()
  const isCardio = isCardioCategory(entry.exercise.category)

  const muscleLabel = (muscle: string) => {
    const key = `muscles.${muscle}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : muscle
  }

  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      className="group rounded-2xl border border-silver/10 bg-card/60 p-3 transition-colors hover:border-silver/25 sm:p-4"
    >
      <ExerciseCard
        index={index}
        name={entry.exercise.name}
        muscles={entry.exercise.muscles}
        displayMuscles={entry.exercise.muscles.map(muscleLabel)}
        image={entry.exercise.image}
        leading={
          <button
            type="button"
            aria-label={t('dragReorder')}
            onPointerDown={(e) => controls.start(e)}
            className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center touch-none text-muted-foreground transition-colors active:cursor-grabbing active:text-foreground"
          >
            <GripVertical className="size-5" aria-hidden="true" />
          </button>
        }
        trailing={
          <button
            type="button"
            onClick={() => onRemove(entry.uid)}
            aria-label={t('removeExercise', { name: entry.exercise.name })}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-red-600/15 active:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 ps-8 sm:ps-9">
          {isCardio ? (
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">
                {t('durationMinutes')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={300}
                step={1}
                value={entry.reps}
                onChange={(e) => onUpdate(entry.uid, { reps: e.target.value })}
                className="h-11 w-20 rounded-full border border-silver/15 bg-background/60 px-3 text-center text-sm font-semibold tabular-nums text-foreground outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/25"
              />
            </label>
          ) : (
            <>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">
              {t('sets')}
            </span>
            <div className="flex items-center rounded-full border border-silver/15 bg-background/60">
              <button
                type="button"
                aria-label={t('fewerSets')}
                onClick={() =>
                  onUpdate(entry.uid, { sets: Math.max(1, entry.sets - 1) })
                }
                className="inline-flex size-11 items-center justify-center text-muted-foreground transition-colors active:text-foreground"
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums text-foreground">
                {entry.sets}
              </span>
              <button
                type="button"
                aria-label={t('moreSets')}
                onClick={() =>
                  onUpdate(entry.uid, { sets: Math.min(10, entry.sets + 1) })
                }
                className="inline-flex size-11 items-center justify-center text-muted-foreground transition-colors active:text-foreground"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">
              {t('reps')}
            </span>
            <input
              type="text"
              value={entry.reps}
              onChange={(e) => onUpdate(entry.uid, { reps: e.target.value })}
              className="h-11 w-20 rounded-full border border-silver/15 bg-background/60 px-3 text-center text-sm font-semibold text-foreground outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/25"
            />
          </label>

          <div className="flex items-center gap-1.5">
            {SET_TYPE_KEYS.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => onUpdate(entry.uid, { setType: type.id })}
                aria-pressed={entry.setType === type.id}
                className={`min-h-11 rounded-full border px-3 text-[9px] font-bold tracking-[0.12em] transition-all ${
                  entry.setType === type.id
                    ? type.active
                    : 'border-border text-muted-foreground hover:border-border hover:text-muted-foreground'
                }`}
              >
                {t(type.labelKey)}
              </button>
            ))}
          </div>
            </>
          )}
        </div>
      </ExerciseCard>
    </Reorder.Item>
  )
}
