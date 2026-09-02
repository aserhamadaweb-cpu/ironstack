/** Client-supplied live workout context for in-session coach chat. */
export type SessionCoachContext = {
  splitName: string
  dayName: string
  dayNote?: string
  /** Zero-based index of the current exercise in today's list. */
  exerciseIndex: number
  totalExercises: number
  elapsedSeconds: number
  currentExercise: {
    name: string
    muscle: string
    liftTypeId?: string
    targetSets: number
    targetReps: string
    category?: string
  }
  previousBest?: {
    weightKg: number
    reps: number
    durationSeconds?: number | null
  } | null
  loggedSetsThisExercise: Array<{
    setNumber: number
    weightKg: number
    reps: number
    durationSeconds?: number | null
    completed: boolean
    skipped: boolean
  }>
  draftSets?: Array<{
    setNumber: number
    weight: string
    reps: string
    durationMinutes?: string
    done: boolean
    skipped: boolean
  }>
  completedExercisesThisSession?: Array<{
    name: string
    muscle: string
    setsLogged: number
  }>
}

const MAX_STRING = 200
const MAX_ARRAY = 20

function clip(value: unknown, max = MAX_STRING): string {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function clipOptional(value: unknown, max = MAX_STRING): string | undefined {
  const trimmed = clip(value, max)
  return trimmed || undefined
}

function asNonNegativeInt(value: unknown, fallback = 0): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function parseSessionCoachContext(
  raw: unknown,
): SessionCoachContext | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const current = o.currentExercise
  if (!current || typeof current !== 'object') return null

  const ce = current as Record<string, unknown>
  const name = clip(ce.name)
  const muscle = clip(ce.muscle)
  if (!name || !muscle) return null

  const splitName = clip(o.splitName)
  const dayName = clip(o.dayName)
  if (!splitName || !dayName) return null

  const exerciseIndex = asNonNegativeInt(o.exerciseIndex)
  const totalExercises = Math.max(1, asNonNegativeInt(o.totalExercises, 1))
  if (exerciseIndex >= totalExercises) return null

  const loggedSetsThisExercise = Array.isArray(o.loggedSetsThisExercise)
    ? o.loggedSetsThisExercise.slice(0, MAX_ARRAY).map((row, i) => {
        const r = (row ?? {}) as Record<string, unknown>
        return {
          setNumber: asNonNegativeInt(r.setNumber, i + 1) || i + 1,
          weightKg: Math.max(0, Number(r.weightKg) || 0),
          reps: Math.max(0, asNonNegativeInt(r.reps)),
          durationSeconds:
            r.durationSeconds == null
              ? null
              : Math.max(0, asNonNegativeInt(r.durationSeconds)),
          completed: Boolean(r.completed),
          skipped: Boolean(r.skipped),
        }
      })
    : []

  const draftSets = Array.isArray(o.draftSets)
    ? o.draftSets.slice(0, MAX_ARRAY).map((row, i) => {
        const r = (row ?? {}) as Record<string, unknown>
        return {
          setNumber: asNonNegativeInt(r.setNumber, i + 1) || i + 1,
          weight: clip(r.weight, 16),
          reps: clip(r.reps, 16),
          durationMinutes: clipOptional(r.durationMinutes, 16),
          done: Boolean(r.done),
          skipped: Boolean(r.skipped),
        }
      })
    : undefined

  const completedExercisesThisSession = Array.isArray(
    o.completedExercisesThisSession,
  )
    ? o.completedExercisesThisSession.slice(0, MAX_ARRAY).map((row) => {
        const r = (row ?? {}) as Record<string, unknown>
        return {
          name: clip(r.name),
          muscle: clip(r.muscle),
          setsLogged: asNonNegativeInt(r.setsLogged),
        }
      })
    : undefined

  let previousBest: SessionCoachContext['previousBest'] = null
  if (o.previousBest && typeof o.previousBest === 'object') {
    const pb = o.previousBest as Record<string, unknown>
    previousBest = {
      weightKg: Math.max(0, Number(pb.weightKg) || 0),
      reps: Math.max(0, asNonNegativeInt(pb.reps)),
      durationSeconds:
        pb.durationSeconds == null
          ? null
          : Math.max(0, asNonNegativeInt(pb.durationSeconds)),
    }
  }

  return {
    splitName,
    dayName,
    dayNote: clipOptional(o.dayNote),
    exerciseIndex,
    totalExercises,
    elapsedSeconds: asNonNegativeInt(o.elapsedSeconds),
    currentExercise: {
      name,
      muscle,
      liftTypeId: clipOptional(ce.liftTypeId, 64),
      targetSets: Math.max(1, asNonNegativeInt(ce.targetSets, 1)),
      targetReps: clip(ce.targetReps, 32) || '8–12',
      category: clipOptional(ce.category, 32),
    },
    previousBest,
    loggedSetsThisExercise,
    draftSets,
    completedExercisesThisSession,
  }
}

function formatSetLine(
  set: SessionCoachContext['loggedSetsThisExercise'][number],
  isCardio: boolean,
): string {
  if (set.skipped) return `Set ${set.setNumber}: skipped`
  if (isCardio) {
    const sec = set.durationSeconds ?? 0
    return `Set ${set.setNumber}: ${sec}s logged`
  }
  return `Set ${set.setNumber}: ${set.weightKg} kg × ${set.reps} reps logged`
}

export function formatSessionContextForPrompt(ctx: SessionCoachContext): string {
  const isCardio = ctx.currentExercise.category === 'cardio'
  const exNum = ctx.exerciseIndex + 1
  const lines = [
    'LIVE SESSION CONTEXT (authoritative for this turn — the athlete is on the in-workout screen; use this instead of get_active_session for current exercise, set count, and logged sets):',
    `Split: ${ctx.splitName}`,
    `Day: ${ctx.dayName}${ctx.dayNote ? ` (${ctx.dayNote})` : ''}`,
    `Progress: Exercise ${exNum} of ${ctx.totalExercises}`,
    `Elapsed: ${Math.floor(ctx.elapsedSeconds / 60)}m ${ctx.elapsedSeconds % 60}s`,
    `Current exercise: ${ctx.currentExercise.name} (${ctx.currentExercise.muscle})`,
    `Prescription: ${ctx.currentExercise.targetSets} sets × ${ctx.currentExercise.targetReps}${isCardio ? ' (cardio — duration)' : ''}`,
  ]

  if (ctx.previousBest) {
    if (isCardio && ctx.previousBest.durationSeconds) {
      lines.push(
        `Previous best for this lift: ${ctx.previousBest.durationSeconds}s`,
      )
    } else if (!isCardio && ctx.previousBest.weightKg > 0) {
      lines.push(
        `Previous best for this lift: ${ctx.previousBest.weightKg} kg × ${ctx.previousBest.reps} reps`,
      )
    } else {
      lines.push('Previous best for this lift: none logged yet')
    }
  } else {
    lines.push('Previous best for this lift: none logged yet')
  }

  const completedCount = ctx.loggedSetsThisExercise.filter(
    (s) => s.completed && !s.skipped,
  ).length
  lines.push(`Sets completed this exercise so far: ${completedCount}`)

  if (ctx.loggedSetsThisExercise.length > 0) {
    lines.push('Logged sets this exercise:')
    for (const set of ctx.loggedSetsThisExercise) {
      lines.push(`- ${formatSetLine(set, isCardio)}`)
    }
  }

  if (ctx.draftSets?.length) {
    const inProgress = ctx.draftSets.filter((s) => !s.done && !s.skipped)
    if (inProgress.length > 0) {
      lines.push('In-progress set inputs (not saved yet):')
      for (const set of inProgress) {
        if (isCardio) {
          lines.push(
            `- Set ${set.setNumber}: ${set.durationMinutes || '—'} min entered`,
          )
        } else {
          lines.push(
            `- Set ${set.setNumber}: ${set.weight || '—'} kg × ${set.reps || '—'} reps entered`,
          )
        }
      }
    }
  }

  if (ctx.completedExercisesThisSession?.length) {
    lines.push('Earlier exercises finished this session:')
    for (const ex of ctx.completedExercisesThisSession) {
      lines.push(`- ${ex.name} (${ex.muscle}) — ${ex.setsLogged} sets logged`)
    }
  }

  return lines.join('\n')
}

/** Build API payload from live session UI state. */
export function buildSessionCoachContext(input: {
  splitName: string
  dayName: string
  dayNote?: string
  exerciseIndex: number
  totalExercises: number
  elapsedSeconds: number
  exercise: {
    name: string
    muscle: string
    liftTypeId?: string
    sets: number
    reps: string
    category?: string
  }
  entries: Array<{
    weight: string
    reps: string
    durationMinutes: string
    done: boolean
    skipped: boolean
    saved: boolean
  }>
  loggedExercises: Array<{
    name: string
    muscle: string
    sets: Array<{ completed: boolean }>
  }>
  previousBest?: {
    weight: number
    reps: number
    durationSeconds?: number | null
  } | null
  toKg: (displayWeight: number) => number
}): SessionCoachContext {
  const isCardio = input.exercise.category === 'cardio'

  const loggedSetsThisExercise = input.entries
    .map((entry, index) => {
      if (!entry.done || entry.skipped || !entry.saved) return null
      if (isCardio) {
        const minutes = Number.parseFloat(entry.durationMinutes)
        return {
          setNumber: index + 1,
          weightKg: 0,
          reps: 0,
          durationSeconds: Number.isFinite(minutes)
            ? Math.round(minutes * 60)
            : 0,
          completed: true,
          skipped: false,
        }
      }
      const weightDisplay = Number.parseFloat(entry.weight)
      const reps = Number.parseInt(entry.reps, 10)
      const weightKg = Number.isFinite(weightDisplay)
        ? input.toKg(weightDisplay)
        : 0
      return {
        setNumber: index + 1,
        weightKg: Number.isFinite(weightKg) ? weightKg : 0,
        reps: Number.isFinite(reps) ? reps : 0,
        durationSeconds: null,
        completed: true,
        skipped: false,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const draftSets = input.entries
    .map((entry, index) => ({
      setNumber: index + 1,
      weight: entry.weight,
      reps: entry.reps,
      durationMinutes: entry.durationMinutes,
      done: entry.done,
      skipped: entry.skipped,
    }))
    .filter((entry) => !entry.done && !entry.skipped)

  const completedExercisesThisSession = input.loggedExercises.map((ex) => ({
    name: ex.name,
    muscle: ex.muscle,
    setsLogged: ex.sets.filter((s) => s.completed).length,
  }))

  return {
    splitName: input.splitName,
    dayName: input.dayName,
    dayNote: input.dayNote,
    exerciseIndex: input.exerciseIndex,
    totalExercises: input.totalExercises,
    elapsedSeconds: input.elapsedSeconds,
    currentExercise: {
      name: input.exercise.name,
      muscle: input.exercise.muscle,
      liftTypeId: input.exercise.liftTypeId,
      targetSets: input.exercise.sets,
      targetReps: input.exercise.reps,
      category: input.exercise.category,
    },
    previousBest: input.previousBest
      ? {
          weightKg: input.previousBest.weight,
          reps: input.previousBest.reps,
          durationSeconds: input.previousBest.durationSeconds ?? null,
        }
      : null,
    loggedSetsThisExercise,
    draftSets: draftSets.length > 0 ? draftSets : undefined,
    completedExercisesThisSession:
      completedExercisesThisSession.length > 0
        ? completedExercisesThisSession
        : undefined,
  }
}
