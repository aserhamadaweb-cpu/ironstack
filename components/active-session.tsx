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
  CloudOff,
  Dumbbell,
  Flag,
  Layers,
  Save,
  Sparkles,
  Trophy,
  Weight,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExerciseDemoGif } from '@/components/exercise-demo-gif'
import { SessionCoachChat } from '@/components/session-coach-chat'
import { CelebrationBanner } from '@/components/celebration-banner'
import { EASE } from '@/components/reveal'
import { resolveSessionUserId } from '@/lib/offline/cache'
import {
  createLocalSession,
  ensureCompletedLocalSession,
  getActiveLocalSession,
  getLocalSession,
  saveSessionProgress,
  upsertLocalLog,
  upsertLocalLogs,
} from '@/lib/offline/session-store'
import { awaitSessionSync, queueSessionSync } from '@/lib/offline/sync'
import { discardPendingSession } from '@/lib/offline/discard-session'
import { useOfflineStatus } from '@/lib/offline/provider'
import { getActiveSessionAction } from '@/lib/data/session-actions'
import { offlineLog, offlineWarn } from '@/lib/offline/debug'
import type { LocalLiftLog, LocalSession } from '@/lib/offline/db'
import {
  buildProgressPayload,
  clearUnfinishedWorkoutReminder,
  notifyUnfinishedWorkout,
  viewFromLocalSession,
  type ActiveWorkoutView,
} from '@/lib/active-workout'
import { ActiveWorkoutConflict } from '@/components/active-workout-conflict'
import { buildSessionCoachContext } from '@/lib/ai/session-context'
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
  avatarUrl?: string | null
  isFirstEver: boolean
  /** Map of lift_type_id → best-ever completed set (weights in kg). */
  previousBests: Record<string, PreviousBest>
  /** Display + input unit; storage remains kg. */
  weightUnit?: WeightUnit
  /** Embedded offline launch: leave/finish without relying on router. */
  onExit?: () => void
  /** Embedded offline: resume a different in-progress split. */
  onSwitchSplit?: (splitSlug: string) => void
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
  /** True once the set has been written locally. */
  saved: boolean
  logId?: string
}

type LoggedExercise = {
  slotId: string
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

function liftKeyFor(exercise: {
  liftTypeId?: string
  id: string
  name: string
}) {
  return exercise.liftTypeId?.trim() || exercise.id || exercise.name
}

function logsFromLoggedExercises(
  exercises: LoggedExercise[],
  existingLogs: LocalLiftLog[] = [],
): LocalLiftLog[] {
  const byKey = new Map(
    existingLogs.map((log) => [`${log.liftTypeId}:${log.setNumber}`, log]),
  )
  const logs: LocalLiftLog[] = []
  for (const ex of exercises) {
    for (const set of ex.sets) {
      const previous = byKey.get(`${ex.liftTypeId}:${set.setNumber}`)
      logs.push({
        id: previous?.id ?? crypto.randomUUID(),
        liftTypeId: ex.liftTypeId,
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
        durationSeconds: set.durationSeconds ?? null,
        isSkipped: !set.completed,
        loggedAt: previous?.loggedAt ?? new Date().toISOString(),
      })
    }
  }
  return logs
}

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
  avatarUrl,
  isFirstEver,
  previousBests,
  weightUnit = 'kg',
  onExit,
  onSwitchSplit,
}: ActiveSessionProps) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const tOffline = useTranslations('offline')
  const { online, hydrated } = useOfflineStatus()

  const [stage, setStage] = useState<Stage>('pick')
  const [dayIndex, setDayIndex] = useState(0)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [entries, setEntries] = useState<SetEntry[]>([])
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [celebrations] = useState<
    Array<{ id: string; title: string; body: string | null }>
  >([])
  const [starting, setStarting] = useState(false)
  const [persisting, setPersisting] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [foreignActive, setForeignActive] = useState<ActiveWorkoutView | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)

  const startRef = useRef<number | null>(null)
  const finalSecRef = useRef(0)
  const missTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  /** Keep a sync copy so Finish Session never reads a stale React state snapshot. */
  const loggedExercisesRef = useRef<LoggedExercise[]>([])
  const writesRef = useRef(Promise.resolve())
  const startedAtRef = useRef<string | null>(null)
  const reminderSentRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const sessionClosedRef = useRef(false)
  const stageRef = useRef(stage)
  const dayIndexRef = useRef(dayIndex)
  const exerciseIndexRef = useRef(exerciseIndex)
  const entriesRef = useRef(entries)
  stageRef.current = stage
  dayIndexRef.current = dayIndex
  exerciseIndexRef.current = exerciseIndex
  entriesRef.current = entries
  const enqueueWrite = (work: Promise<unknown>) => {
    writesRef.current = writesRef.current
      .then(() => work)
      .then(() => undefined)
      .catch(() => undefined)
    return writesRef.current
  }

  const persistProgress = async (
    nextSessionId?: string | null,
    snapshot?: {
      stage?: typeof stage
      dayIndex?: number
      exerciseIndex?: number
    },
  ) => {
    if (sessionClosedRef.current) return
    const id = nextSessionId ?? sessionIdRef.current
    if (!id) return
    const currentStage = snapshot?.stage ?? stageRef.current
    if (currentStage === 'pick' || currentStage === 'summary') return
    const dayIdx = snapshot?.dayIndex ?? dayIndexRef.current
    const exIdx = snapshot?.exerciseIndex ?? exerciseIndexRef.current
    await enqueueWrite(
      saveSessionProgress(
        id,
        buildProgressPayload({
          splitName: split.name,
          dayIndex: dayIdx,
          dayId: split.schedule[dayIdx]?.id ?? '',
          dayName: split.schedule[dayIdx]?.focus ?? '',
          exerciseIndex: exIdx,
          totalExercises: split.schedule[dayIdx]?.exercises.length ?? 0,
          stage: currentStage,
          loggedExercises: loggedExercisesRef.current,
          currentEntries: entriesRef.current,
          reminderSent: reminderSentRef.current,
        }),
      ),
    )
  }

  const restoreFromLocal = (active: LocalSession) => {
    const progress = active.progress
    const dayIdx =
      progress?.dayIndex ??
      split.schedule.findIndex((row) => row.id === active.splitDayId)
    const safeDay = dayIdx >= 0 ? dayIdx : 0
    const dayRow = split.schedule[safeDay]
    if (!dayRow?.exercises?.length) return false

    startedAtRef.current = active.startedAt
    startRef.current = new Date(active.startedAt).getTime()
    setElapsed(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)))
    setSessionId(active.id)
    sessionIdRef.current = active.id
    setDayIndex(safeDay)
    dayIndexRef.current = safeDay
    reminderSentRef.current = Boolean(progress?.reminderSent)
    if (progress?.loggedExercises?.length) {
      loggedExercisesRef.current = progress.loggedExercises
      setLoggedExercises(progress.loggedExercises)
    }
    const exIdx = Math.min(
      progress?.exerciseIndex ?? 0,
      Math.max((dayRow.exercises.length ?? 1) - 1, 0),
    )
    setExerciseIndex(exIdx)
    exerciseIndexRef.current = exIdx
    const restoredEntries = progress?.currentEntries
    const nextEntries = restoredEntries?.length
      ? restoredEntries
      : makeEntries(dayRow.exercises[exIdx]?.sets ?? 0)
    setEntries(nextEntries)
    entriesRef.current = nextEntries
    const nextStage =
      progress?.stage === 'summary'
        ? 'done'
        : progress?.stage && progress.stage !== 'pick'
          ? progress.stage
          : 'lift'
    setStage(nextStage)
    stageRef.current = nextStage
    return true
  }

  const exitSession = (opts?: { refresh?: boolean }) => {
    if (onExit) {
      onExit()
      return
    }
    const href = online ? '/dashboard/workout' : '/dashboard/home'
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      router.push('/dashboard/home')
      return
    }
    if (opts?.refresh === false) {
      router.push(href)
      return
    }
    router.replace(href)
    router.refresh()
  }

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

  useEffect(() => {
    if (stage !== 'lift' && coachOpen) setCoachOpen(false)
  }, [stage, coachOpen])

  const sessionCoachContext = useMemo(() => {
    if (stage !== 'lift' || !day || !exercise) return null
    const liftKey = liftKeyFor(exercise)
    const previousBest = exercise.liftTypeId
      ? previousBests[exercise.liftTypeId]
      : previousBests[liftKey]
    return buildSessionCoachContext({
      splitName: split.name,
      dayName: day.focus,
      dayNote: day.note || undefined,
      exerciseIndex,
      totalExercises: day.exercises.length,
      elapsedSeconds: elapsed,
      exercise,
      entries,
      loggedExercises,
      previousBest: previousBest ?? null,
      toKg: (displayWeight) => displayToKg(displayWeight, weightUnit),
    })
  }, [
    stage,
    day,
    exercise,
    split.name,
    exerciseIndex,
    elapsed,
    entries,
    loggedExercises,
    previousBests,
    weightUnit,
  ])

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const userId = await resolveSessionUserId().catch(() => null)
        if (userId) userIdRef.current = userId
        const active = await getActiveLocalSession(userId)
        if (cancelled) return
        if (!active) {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            const remote = await getActiveSessionAction()
            if (cancelled) return
            // Another start/hydrate may have written IndexedDB while we awaited.
            const latest = await getActiveLocalSession(userId)
            if (cancelled) return
            if (latest?.splitId === split.slug) {
              restoreFromLocal(latest)
              setHydrating(false)
              return
            }
            const remoteSession = remote.data
            if (remoteSession?.splitId === split.slug && userId) {
              const alreadyLocal = await getLocalSession(remoteSession.id)
              if (
                alreadyLocal?.status === 'completed' ||
                alreadyLocal?.status === 'cancelled'
              ) {
                // Zombie in_progress on server after a partial offline sync —
                // keep local terminal state and push finish; do not revive UI.
                offlineLog('session.hydrate.skip-terminal', {
                  id: alreadyLocal.id,
                  status: alreadyLocal.status,
                  syncStatus: alreadyLocal.syncStatus,
                })
                if (alreadyLocal.syncStatus !== 'synced') {
                  queueSessionSync(alreadyLocal)
                }
                setHydrating(false)
                return
              }
              const created = await createLocalSession({
                id: remoteSession.id,
                userId,
                splitId: remoteSession.splitId,
                splitDayId: remoteSession.splitDayId,
                startedAt: remoteSession.startedAt,
              })
              if (cancelled) return
              restoreFromLocal(created)
            }
          }
          setHydrating(false)
          return
        }
        if (active.splitId !== split.slug) {
          setForeignActive(viewFromLocalSession(active))
          setHydrating(false)
          return
        }
        restoreFromLocal(active)
      } finally {
        if (!cancelled) setHydrating(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per split slug; schedule read inside effect
  }, [split.slug])

  useEffect(() => {
    if (hydrating || !sessionId || stage === 'pick' || stage === 'summary') return
    void persistProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persistProgress identity would re-save every render
  }, [hydrating, sessionId, stage, dayIndex, exerciseIndex, entries, loggedExercises])

  useEffect(() => {
    if (hydrating || !sessionId || stage === 'pick' || stage === 'summary') return
    const onOffline = () => {
      void persistProgress()
    }
    window.addEventListener('offline', onOffline)
    return () => window.removeEventListener('offline', onOffline)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on connectivity drop only
  }, [hydrating, sessionId, stage])

  // When connectivity returns, push the local in-progress session without
  // resetting IDB progress (online ↔ offline continuity).
  useEffect(() => {
    if (!online || hydrating || !sessionId || stage === 'pick') return
    let cancelled = false
    void (async () => {
      await writesRef.current.catch(() => undefined)
      await persistProgress()
      await writesRef.current.catch(() => undefined)
      if (cancelled) return
      const local = await getLocalSession(sessionId)
      if (cancelled || !local || local.status !== 'in_progress') return
      queueSessionSync(local)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync on reconnect / session id
  }, [online, hydrating, sessionId, stage])

  useEffect(() => {
    if (!sessionId || stage === 'pick' || stage === 'summary') return
    const flushProgress = () => {
      if (sessionClosedRef.current) return
      // Kick IDB write immediately; keep a handle so freeze/pagehide can race
      // the browser kill less often than a fire-and-forget with no queue push.
      void enqueueWrite(
        saveSessionProgress(
          sessionIdRef.current!,
          buildProgressPayload({
            splitName: split.name,
            dayIndex: dayIndexRef.current,
            dayId: split.schedule[dayIndexRef.current]?.id ?? '',
            dayName: split.schedule[dayIndexRef.current]?.focus ?? '',
            exerciseIndex: exerciseIndexRef.current,
            totalExercises:
              split.schedule[dayIndexRef.current]?.exercises.length ?? 0,
            stage: stageRef.current,
            loggedExercises: loggedExercisesRef.current,
            currentEntries: entriesRef.current,
            reminderSent: reminderSentRef.current,
          }),
        ),
      )
    }
    const onHide = () => {
      flushProgress()
      if (document.visibilityState === 'hidden' && !reminderSentRef.current) {
        notifyUnfinishedWorkout()
        reminderSentRef.current = true
        flushProgress()
      }
    }
    const onPageHide = () => {
      flushProgress()
    }
    const onFreeze = () => {
      flushProgress()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('freeze', onFreeze)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('freeze', onFreeze)
      if (!sessionClosedRef.current) flushProgress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- event listeners; omit persistProgress to avoid re-bind loops
  }, [sessionId, stage, dayIndex, exerciseIndex, entries, split.name, split.schedule])

  const startSession = async (index: number) => {
    setActionError(null)
    setStarting(true)
    sessionClosedRef.current = false
    const dayRow = split.schedule[index]
    const sessionIdLocal = crypto.randomUUID()
    const startedAt = new Date().toISOString()

    try {
      const userId = await resolveSessionUserId()
      if (!userId) {
        setActionError('You must be signed in to start a session.')
        return
      }
      userIdRef.current = userId

      const existing = await getActiveLocalSession(userId)
      if (existing && existing.splitId !== split.slug) {
        setForeignActive(viewFromLocalSession(existing))
        return
      }
      if (!dayRow?.exercises?.length) {
        setActionError('This training day has no exercises yet.')
        return
      }
      if (existing && existing.splitId === split.slug) {
        restoreFromLocal(existing)
        return
      }

      const local = await createLocalSession({
        id: sessionIdLocal,
        userId,
        splitId: split.slug,
        splitDayId: dayRow.id,
        startedAt,
      })
      if (local.id !== sessionIdLocal) {
        restoreFromLocal(local)
        return
      }
      startedAtRef.current = startedAt
      offlineLog('session.start.local', {
        id: local.id,
        userId,
        splitId: split.slug,
        dayId: dayRow.id,
      })
      queueSessionSync(local)

      const initialEntries = makeEntries(dayRow.exercises[0]?.sets ?? 0)
      setSessionId(local.id)
      sessionIdRef.current = local.id
      setDayIndex(index)
      dayIndexRef.current = index
      setExerciseIndex(0)
      exerciseIndexRef.current = 0
      setEntries(initialEntries)
      entriesRef.current = initialEntries
      loggedExercisesRef.current = []
      setLoggedExercises([])
      startRef.current = Date.now()
      setElapsed(0)
      setStage('lift')
      stageRef.current = 'lift'
      void persistProgress(local.id, {
        stage: 'lift',
        dayIndex: index,
        exerciseIndex: 0,
      })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not start the session.',
      )
    } finally {
      setStarting(false)
    }
  }

  const persistLog = async (log: LocalLiftLog) => {
    if (!sessionId) return
    await enqueueWrite(
      upsertLocalLog(sessionId, log).then((local) => {
        if (local) queueSessionSync(local)
        return local
      }),
    )
  }

  /**
   * Checkmark only updates local UI state. DB writes happen once on
   * "Finish exercise" so we never race and re-save completed sets as skipped.
   */
  const toggleSet = (index: number) => {
    setEntries((prev) => {
      const entry = prev[index]
      if (!entry || entry.saved) return prev
      const cardio = isCardioCategory(exercise?.category)
      if (entry.done) {
        return prev.map((e, i) => (i === index ? { ...e, done: false } : e))
      }

      const missDuration = !(Number.parseFloat(entry.durationMinutes) > 0)
      const missWeight = !(Number.parseFloat(entry.weight) > 0)
      const missReps = !(Number.parseInt(entry.reps, 10) > 0)
      if (cardio ? missDuration : missWeight || missReps) {
        const existing = missTimersRef.current.get(index)
        if (existing) clearTimeout(existing)
        missTimersRef.current.set(
          index,
          setTimeout(() => {
            setEntries((current) =>
              current.map((e, i) =>
                i === index
                  ? { ...e, missWeight: false, missReps: false, missDuration: false }
                  : e,
              ),
            )
          }, 1400),
        )
        return prev.map((e, i) =>
          i === index
            ? {
                ...e,
                missDuration: cardio ? missDuration : false,
                missWeight: cardio ? false : missWeight,
                missReps: cardio ? false : missReps,
              }
            : e,
        )
      }

      const logId = entry.logId ?? crypto.randomUUID()
      if (exercise) {
        const minutes = Number.parseFloat(entry.durationMinutes)
        const weight = Number.parseFloat(entry.weight)
        const reps = Number.parseInt(entry.reps, 10)
        void persistLog({
          id: logId,
          liftTypeId: liftKeyFor(exercise),
          setNumber: index + 1,
          weight: cardio ? 0 : displayToKg(weight, weightUnit),
          reps: cardio ? 0 : reps,
          durationSeconds:
            cardio && Number.isFinite(minutes)
              ? Math.round(minutes * 60)
              : null,
          isSkipped: false,
          loggedAt: new Date().toISOString(),
        })
      }

      return prev.map((e, i) =>
        i === index
          ? {
              ...e,
              done: true,
              skipped: false,
              saved: true,
              logId,
              missWeight: false,
              missReps: false,
              missDuration: false,
            }
          : e,
      )
    })
  }

  const updateEntry = (index: number, patch: Partial<SetEntry>) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    )
  }

  const finishExercise = async () => {
    if (persisting) return
    if (!sessionId) {
      setActionError('Session is not ready yet. Start the session again.')
      return
    }
    if (!exercise) return

    setPersisting(true)
    const liftTypeId = liftKeyFor(exercise)
    setActionError(null)

    const isCardio = isCardioCategory(exercise.category)
    const nextEntries = entries.map((entry) => ({ ...entry }))
    const persistedSets: LoggedExercise['sets'] = []
    const logs: LocalLiftLog[] = []

    for (let i = 0; i < nextEntries.length; i += 1) {
      const entry = nextEntries[i]

      if (isCardio) {
        const minutes = Number.parseFloat(entry.durationMinutes)
        const hasDuration = Number.isFinite(minutes) && minutes > 0
        const durationSeconds = hasDuration ? Math.round(minutes * 60) : 0

        if (entry.done) {
          if (!hasDuration) {
            setActionError(`Set ${i + 1} is checked but missing duration.`)
            setPersisting(false)
            return
          }
          const logId = entry.logId ?? crypto.randomUUID()
          logs.push({
            id: logId,
            liftTypeId,
            setNumber: i + 1,
            weight: 0,
            reps: 0,
            durationSeconds,
            isSkipped: false,
            loggedAt: new Date().toISOString(),
          })
          nextEntries[i] = { ...entry, saved: true, skipped: false, logId }
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

        const logId = entry.logId ?? crypto.randomUUID()
        logs.push({
          id: logId,
          liftTypeId,
          setNumber: i + 1,
          weight: 0,
          reps: 0,
          durationSeconds,
          isSkipped: true,
          loggedAt: new Date().toISOString(),
        })
        nextEntries[i] = { ...entry, skipped: true, saved: true, logId }
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
            setPersisting(false)
            return
          }
        const weightKg = displayToKg(weight, weightUnit)
        const logId = entry.logId ?? crypto.randomUUID()
        logs.push({
          id: logId,
          liftTypeId,
          setNumber: i + 1,
          weight: weightKg,
          reps,
          durationSeconds: null,
          isSkipped: false,
          loggedAt: new Date().toISOString(),
        })
        nextEntries[i] = { ...entry, saved: true, skipped: false, logId }
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
      const logId = entry.logId ?? crypto.randomUUID()
      logs.push({
        id: logId,
        liftTypeId,
        setNumber: i + 1,
        weight: weightKg,
        reps,
        durationSeconds: null,
        isSkipped: true,
        loggedAt: new Date().toISOString(),
      })
      nextEntries[i] = { ...entry, skipped: true, saved: true, logId }
      persistedSets.push({
        setNumber: i + 1,
        weight: weightKg,
        reps,
        completed: false,
      })
    }

    const logged: LoggedExercise = {
      slotId: exercise.id,
      name: exercise.name,
      muscle: exercise.muscle,
      liftTypeId,
      isCardio,
      targetSets: exercise.sets,
      targetReps: exercise.reps,
      sets: persistedSets,
    }
    loggedExercisesRef.current = [
      ...loggedExercisesRef.current.filter((row) => row.slotId !== logged.slotId),
      logged,
    ]
    setLoggedExercises(loggedExercisesRef.current)

    if (exerciseIndex + 1 < (day?.exercises.length ?? 0)) {
      setExerciseIndex(exerciseIndex + 1)
      setEntries(makeEntries(day.exercises[exerciseIndex + 1].sets))
    } else {
      setStage('done')
    }

    const sessionIdLocal = sessionId
    void enqueueWrite(
      upsertLocalLogs(sessionIdLocal, logs).then((local) => {
        if (local) {
          offlineLog('session.logs.local', {
            sessionId: sessionIdLocal,
            logs: logs.length,
          })
          queueSessionSync(local)
        } else {
          offlineWarn('session.logs.missing-row', { sessionId: sessionIdLocal })
        }
        return local
      }),
    ).catch((err) => {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Sets are on this device but could not be queued.',
      )
    })
    setPersisting(false)
  }

  const finishSession = async () => {
    if (!sessionId || persisting || sessionClosedRef.current) return
    setActionError(null)
    setPersisting(true)
    sessionClosedRef.current = true
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

    try {
      await writesRef.current.catch(() => undefined)
      const userId =
        userIdRef.current || (await resolveSessionUserId().catch(() => null))
      if (!userId) {
        sessionClosedRef.current = false
        setActionError('Could not save this session on this device.')
        offlineWarn('session.finish.no-user', { sessionId })
        return
      }
      userIdRef.current = userId
      const dayRow = split.schedule[dayIndex]
      const existing = await getLocalSession(sessionId)
      const local = await ensureCompletedLocalSession({
        id: sessionId,
        userId,
        splitId: split.slug,
        splitDayId: dayRow?.id ?? sessionId,
        startedAt: startedAtRef.current ?? new Date().toISOString(),
        durationSeconds: finalSecRef.current,
        logs: logsFromLoggedExercises(exercises, existing?.logs ?? []),
        prs,
      })
      if (local.status !== 'completed') {
        sessionClosedRef.current = false
        setActionError('Could not save this session on this device.')
        return
      }
      offlineLog('session.finish.local', {
        id: local.id,
        userId: local.userId,
        logs: local.logs.length,
        syncStatus: local.syncStatus,
      })
      try {
        await awaitSessionSync(local)
      } catch (err) {
        offlineWarn('session.finish.sync', {
          sessionId,
          message: err instanceof Error ? err.message : String(err),
        })
        queueSessionSync(local)
      }
      clearUnfinishedWorkoutReminder()
      setStage('summary')
    } catch (err) {
      sessionClosedRef.current = false
      offlineWarn('session.finish.failed', {
        sessionId,
        message: err instanceof Error ? err.message : String(err),
      })
      setActionError(
        err instanceof Error ? err.message : 'Could not save this session on this device.',
      )
    } finally {
      setPersisting(false)
    }
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

  const exitHref = online ? '/dashboard/workout' : '/dashboard/home'

  const handleSave = () => {
    if (saving) return
    setSaving(true)
    sessionClosedRef.current = true
    setSessionId(null)
    sessionIdRef.current = null
    exitSession()
  }

  const leaveWorkout = async () => {
    await writesRef.current.catch(() => undefined)
    await persistProgress()
    await writesRef.current.catch(() => undefined)
    exitSession({ refresh: false })
  }

  const discardWorkout = async () => {
    if (!sessionId || persisting || sessionClosedRef.current) return
    setPersisting(true)
    setActionError(null)
    sessionClosedRef.current = true
    try {
      const result = await discardPendingSession(sessionId)
      if (result.error) {
        sessionClosedRef.current = false
        setActionError(result.error)
        setPersisting(false)
        return
      }
      clearUnfinishedWorkoutReminder()
      setConfirmDiscard(false)
      setSessionId(null)
      sessionIdRef.current = null
      exitSession()
    } catch (err) {
      sessionClosedRef.current = false
      setActionError(
        err instanceof Error ? err.message : 'Could not discard this session.',
      )
      setPersisting(false)
    }
  }

  useEffect(() => {
    if (!confirmDiscard) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !persisting) setConfirmDiscard(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDiscard, persisting])

  const uncheckedCount = entries.filter((e) => !e.done && !e.skipped).length
  const isLastExercise = exerciseIndex === (day?.exercises.length ?? 0) - 1
  const sessionOffline = hydrated && !online && stage !== 'pick'

  return (
    <div className="relative min-h-svh overflow-x-clip pb-24 md:pb-10">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(198,40,40,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} avatarUrl={avatarUrl} />

      {sessionOffline ? (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-2.5 text-center text-xs font-semibold text-gold">
          <span className="inline-flex items-center justify-center gap-1.5">
            <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
            {tOffline('sessionOfflineNote')}
          </span>
        </div>
      ) : null}

      {hydrating ? (
        <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground">
          Restoring your workout…
        </main>
      ) : null}

      {foreignActive ? (
        <ActiveWorkoutConflict
          active={foreignActive}
          onResolved={() => setForeignActive(null)}
          onStay={() => setForeignActive(null)}
          onResumeOffline={(slug) => {
            setForeignActive(null)
            if (slug === split.slug) return
            if (onSwitchSplit) {
              onSwitchSplit(slug)
              return
            }
            if (onExit) {
              onExit()
              return
            }
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              router.push(`/dashboard/splits/${slug}/session`)
            }
          }}
        />
      ) : null}

      {confirmDiscard ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-session-title"
          aria-describedby="discard-session-body"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-background/70 p-4 sm:items-center"
        >
          <div className="is-panel w-full max-w-md p-5">
            <h2 id="discard-session-title" className="font-heading text-xl font-bold">
              Discard this session?
            </h2>
            <p id="discard-session-body" className="mt-2 text-sm text-muted-foreground">
              This unfinished workout and its unsaved progress will be removed. It will not count as a completed workout.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={persisting}
                onClick={() => void discardWorkout()}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-destructive px-4 text-sm font-bold tracking-[0.12em] text-destructive-foreground disabled:opacity-60"
              >
                {persisting ? 'Discarding…' : 'Discard session'}
              </button>
              <button
                type="button"
                disabled={persisting}
                onClick={() => setConfirmDiscard(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/20 px-4 text-sm font-semibold"
              >
                Keep session
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(stage === 'lift' || stage === 'done') && !hydrating && day && (
        <div className="sticky top-[var(--app-header-height)] z-40 border-b border-silver/10 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.25em] text-gold">
                {day.focus.toUpperCase()}
              </p>
              <p className="truncate text-xs text-muted-foreground">{split.name}</p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              {stage === 'lift' && (
                <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground sm:hidden">
                  {exerciseIndex + 1}/{day.exercises.length}
                </span>
              )}
              {stage === 'lift' && (
                <span className="hidden text-[10px] font-semibold tracking-[0.18em] text-muted-foreground sm:inline">
                  EXERCISE {exerciseIndex + 1} OF {day.exercises.length}
                </span>
              )}
              <span
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 font-heading text-base font-bold tabular-nums text-gold sm:px-4 sm:py-2 sm:text-lg"
                aria-label="Session timer"
              >
                <Clock3 className="size-4" aria-hidden="true" />
                {formatClock(elapsed)}
              </span>
            </div>
          </div>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
            <button
              type="button"
              onClick={() => void leaveWorkout()}
              className="inline-flex min-h-11 items-center rounded-full border border-silver/20 px-4 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              Leave workout
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="inline-flex min-h-11 items-center rounded-full border border-destructive/30 px-4 text-[11px] font-semibold tracking-[0.12em] text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              Discard session
            </button>
          </div>
          {stage === 'lift' && (
            <div className="h-1 w-full bg-muted" aria-hidden="true">
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{
                  width: `${((exerciseIndex + 1) / Math.max(day.exercises.length, 1)) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {!hydrating ? (
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
            {onExit ? (
              <button
                type="button"
                onClick={() => exitSession({ refresh: false })}
                className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {online ? 'BACK TO WORKOUT' : 'BACK TO HOME'}
              </button>
            ) : (
              <Link
                href={exitHref}
                className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {online ? 'BACK TO WORKOUT' : 'BACK TO HOME'}
              </Link>
            )}

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
                  <div>
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
                  <ExerciseDemoGif
                    name={exercise.name}
                    muscle={exercise.muscle}
                    image={exercise.image}
                    gif={exercise.gif}
                    reduceMotion={Boolean(reduce)}
                  />
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
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3">
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

                          <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
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
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                toggleSet(index)
                              }}
                              disabled={entry.saved}
                              aria-pressed={entry.done}
                              aria-label={
                                entry.done
                                  ? `Set ${index + 1} completed — tap to undo`
                                  : `Mark set ${index + 1} complete`
                              }
                              className={`relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 disabled:cursor-default ${
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
                      {summary.baselines.map((baseline, index) => (
                        <div
                          key={`${baseline.exercise}-${index}`}
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
                  {summary.prs.map((pr, index) => (
                    <div
                      key={`${pr.exercise}-${index}`}
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
                {loggedExercises.map((logged, index) => (
                  <article
                    key={logged.slotId || `${logged.liftTypeId}-${index}`}
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
      ) : null}

      {stage === 'lift' && sessionCoachContext ? (
        <SessionCoachChat
          open={coachOpen}
          onOpenChange={setCoachOpen}
          displayName={displayName}
          sessionContext={sessionCoachContext}
        />
      ) : null}
    </div>
  )
}
