import { getExerciseById } from '@/lib/exercises/catalog'
import { isHomeEquipment } from '@/lib/exercises/home-workouts'
import {
  catalogExerciseToLibrary,
  resolveExerciseRef,
} from '@/lib/ai/catalog-lookup'
import type {
  SplitProposal,
  SplitProposalDay,
  SplitProposalExercise,
  SplitProposalSource,
} from '@/lib/ai/action-types'
import type { SaveSplitInput } from '@/lib/data/save-split'
import { normalizeKey } from '@/lib/exercises/normalizers'
import { formatTargetReps } from '@/lib/split-reps'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RawExercise = {
  exercise_id?: unknown
  exerciseId?: unknown
  name?: unknown
  sets?: unknown
  reps?: unknown
}

type RawDay = {
  name?: unknown
  subtitle?: unknown
  exercises?: unknown
}

export function coerceArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      return coerceArray(JSON.parse(value))
    } catch {
      return []
    }
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const keys = Object.keys(rec)
    if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => rec[key])
    }
  }
  return []
}

function asPositiveInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function hydrateExercise(
  raw: RawExercise,
  homeOnly: boolean,
):
  | { ok: true; exercise: SplitProposalExercise; substitutedFrom?: string }
  | { ok: false; error: string } {
  const idRaw = String(raw.exercise_id ?? raw.exerciseId ?? '').trim()
  const nameRaw = String(raw.name ?? '').trim()
  const resolved = resolveExerciseRef(idRaw, nameRaw, { homeOnly })
  if (!resolved.id) {
    return {
      ok: false,
      error: `Unknown exercise "${nameRaw || idRaw}".`,
    }
  }
  const catalog = getExerciseById(resolved.id)
  if (!catalog) {
    return { ok: false, error: `Unknown exercise id "${resolved.id}".` }
  }
  if (homeOnly && !isHomeEquipment(catalog.equipment)) {
    return {
      ok: false,
      error: `${catalog.name} (${catalog.sourceId}) needs gym equipment (${catalog.equipment}) and cannot be used in a home plan.`,
    }
  }
  const sets = asPositiveInt(raw.sets, 3, 1, 10)
  const reps = String(raw.reps ?? '8–12').trim() || '8–12'
  const substitutedFrom =
    nameRaw &&
    normalizeKey(nameRaw) !== normalizeKey(catalog.name) &&
    resolved.matchedAs
      ? nameRaw
      : undefined
  return {
    ok: true,
    exercise: {
      exerciseId: catalog.sourceId,
      name: catalog.name,
      equipment: catalog.equipment,
      muscle: catalog.target || catalog.muscleGroup,
      sets,
      reps,
      homeSuitable: isHomeEquipment(catalog.equipment),
      image: catalog.image || null,
    },
    substitutedFrom,
  }
}

/** Safe defaults when a day would otherwise be empty after unknown-name skips. */
const DAY_FALLBACK_IDS: Array<{ match: RegExp; ids: string[] }> = [
  { match: /\b(chest|push|bench|pec)\b/i, ids: ['0025', '0048', '0226'] },
  { match: /\b(back|pull|lat|row)\b/i, ids: ['0861', '2330', '0027'] },
  { match: /\b(leg|quad|squat|glute|ham)\b/i, ids: ['0043', '0585', '0085'] },
  { match: /\b(shoulder|delt|press|arm|bicep|tricep)\b/i, ids: ['0091', '0334', '0060'] },
  { match: /\b(core|abs|cardio)\b/i, ids: ['0274', '0871'] },
]

const GENERIC_FALLBACK_IDS = ['0025', '0861', '0043', '0091', '0060']

function fallbackExercisesForDay(
  dayName: string,
  homeOnly: boolean,
  used: Set<string>,
  count: number,
): SplitProposalExercise[] {
  const pool =
    DAY_FALLBACK_IDS.find((row) => row.match.test(dayName))?.ids ?? GENERIC_FALLBACK_IDS
  const out: SplitProposalExercise[] = []
  for (const id of [...pool, ...GENERIC_FALLBACK_IDS]) {
    if (out.length >= count) break
    if (used.has(id)) continue
    const result = hydrateExercise({ exercise_id: id, sets: 3, reps: '8–12' }, homeOnly)
    if (!result.ok) continue
    used.add(result.exercise.exerciseId)
    out.push(result.exercise)
  }
  return out
}

export function buildSplitProposal(input: {
  kind: 'create_split' | 'update_split'
  splitId?: string
  name?: unknown
  description?: unknown
  daysPerWeek?: unknown
  days?: unknown
  assumptions?: unknown
  questions?: unknown
  basedOn?: unknown
  homeOnly?: boolean
}): { ok: true; proposal: SplitProposal } | { ok: false; error: string; questions?: string[] } {
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Split name is required.' }

  const rawDays = coerceArray(input.days) as RawDay[]
  if (rawDays.length < 1 || rawDays.length > 7) {
    return { ok: false, error: 'A split needs between 1 and 7 training days.' }
  }

  const homeOnly = Boolean(input.homeOnly)
  const warnings: string[] = []
  const days: SplitProposalDay[] = []

  for (let i = 0; i < rawDays.length; i += 1) {
    const raw = rawDays[i] ?? {}
    const dayName = String(raw.name ?? `Day ${i + 1}`).trim() || `Day ${i + 1}`
    const exercisesRaw = coerceArray(raw.exercises) as RawExercise[]
    if (exercisesRaw.length < 1 || exercisesRaw.length > 12) {
      return {
        ok: false,
        error: `Day ${i + 1} must have between 1 and 12 catalog exercises.`,
      }
    }
    const exercises: SplitProposalExercise[] = []
    const seen = new Set<string>()
    for (const row of exercisesRaw) {
      const label = String(row.name ?? row.exercise_id ?? row.exerciseId ?? 'exercise').trim()
      const result = hydrateExercise(row, homeOnly)
      if (!result.ok) {
        // Never abort the whole split for one bad nickname — day defaults fill gaps.
        warnings.push(`Couldn’t resolve “${label}” on ${dayName}; used a catalog stand-in if needed.`)
        continue
      }
      if (seen.has(result.exercise.exerciseId)) continue
      seen.add(result.exercise.exerciseId)
      if (result.substitutedFrom) {
        warnings.push(
          `Mapped “${result.substitutedFrom}” → ${result.exercise.name} on ${dayName}.`,
        )
      }
      exercises.push(result.exercise)
    }

    if (exercises.length === 0) {
      const filled = fallbackExercisesForDay(dayName, homeOnly, seen, 4)
      if (filled.length === 0) {
        return {
          ok: false,
          error: `Day ${i + 1} needs at least one catalog exercise we can resolve.`,
        }
      }
      warnings.push(`Used catalog defaults for ${dayName} after unknown exercise names.`)
      exercises.push(...filled)
    } else if (exercises.length < Math.min(3, exercisesRaw.length)) {
      // Partial day — top up so the plan stays usable.
      const needed = Math.min(4, exercisesRaw.length) - exercises.length
      if (needed > 0) {
        exercises.push(...fallbackExercisesForDay(dayName, homeOnly, seen, needed))
      }
    }

    days.push({
      name: dayName,
      subtitle: String(raw.subtitle ?? '').trim() || null,
      exercises,
    })
  }

  const basedOn = (
    ['prs', 'history', 'preferences', 'catalog_defaults', 'mixed'] as SplitProposalSource[]
  ).includes(String(input.basedOn) as SplitProposalSource)
    ? (input.basedOn as SplitProposalSource)
    : 'catalog_defaults'

  const assumptions = coerceArray(input.assumptions)
    .map((row) => String(row).trim())
    .filter(Boolean)
    .slice(0, 8)
  const questions = coerceArray(input.questions)
    .map((row) => String(row).trim())
    .filter(Boolean)
    .slice(0, 6)

  const rawSplitId = String(input.splitId ?? '').trim()
  if (input.kind === 'update_split' && !UUID_RE.test(rawSplitId)) {
    return { ok: false, error: 'That split id is not valid.' }
  }
  const splitId = UUID_RE.test(rawSplitId) ? rawSplitId : crypto.randomUUID()

  return {
    ok: true,
    proposal: {
      id: crypto.randomUUID(),
      kind: input.kind,
      splitId,
      name,
      description:
        String(input.description ?? '').trim() ||
        `${days.length}-day plan from IronStack Coach.`,
      daysPerWeek: asPositiveInt(input.daysPerWeek, days.length, 1, 7),
      days,
      assumptions,
      questions,
      basedOn,
      warnings: warnings.slice(0, 12),
    },
  }
}

export function proposalToSaveInput(proposal: SplitProposal): SaveSplitInput | { error: string } {
  const days = []
  for (const day of proposal.days) {
    const exercises = []
    for (const entry of day.exercises) {
      const lib = catalogExerciseToLibrary(entry.exerciseId)
      if (!lib) {
        return { error: `Catalog exercise ${entry.exerciseId} is no longer available.` }
      }
      exercises.push({
        libraryId: lib.id,
        name: lib.name,
        muscles: lib.muscles,
        image: lib.image,
        sets: entry.sets,
        reps: entry.reps,
        category: lib.category,
        equipment: lib.equipment,
      })
    }
    days.push({
      name: day.name,
      subtitle: day.subtitle,
      exercises,
    })
  }
  return {
    id: proposal.splitId,
    name: proposal.name,
    description: proposal.description,
    category: 'Hypertrophy',
    daysPerWeek: proposal.daysPerWeek,
    days,
  }
}

export type SplitMutationOp =
  | {
      op: 'add'
      day_index: number
      exercise_id: string
      sets?: number
      reps?: string
      index?: number
    }
  | { op: 'remove'; day_index: number; exercise_id?: string; index?: number }
  | { op: 'replace'; day_index: number; from_exercise_id: string; to_exercise_id: string }
  | { op: 'reorder'; day_index: number; from_index: number; to_index: number }
  | {
      op: 'set_targets'
      day_index: number
      exercise_id?: string
      index?: number
      sets?: number
      reps?: string
    }
  | { op: 'rename_day'; day_index: number; name: string }

export function applySplitOps(
  base: SplitProposal,
  ops: SplitMutationOp[],
  homeOnly = false,
): { ok: true; proposal: SplitProposal } | { ok: false; error: string } {
  const days = base.days.map((day) => ({
    ...day,
    exercises: [...day.exercises],
  }))

  for (const op of ops.slice(0, 40)) {
    const day = days[op.day_index]
    if (!day) return { ok: false, error: `No training day at index ${op.day_index}.` }

    if (op.op === 'rename_day') {
      const name = op.name.trim()
      if (!name) return { ok: false, error: 'Day name cannot be empty.' }
      day.name = name
      continue
    }

    if (op.op === 'add') {
      const result = hydrateExercise(
        { exercise_id: op.exercise_id, sets: op.sets, reps: op.reps },
        homeOnly,
      )
      if (!result.ok) return result
      const at = op.index == null ? day.exercises.length : Math.max(0, Math.min(day.exercises.length, op.index))
      day.exercises.splice(at, 0, result.exercise)
      if (day.exercises.length > 12) {
        return { ok: false, error: 'A day cannot have more than 12 exercises.' }
      }
      continue
    }

    if (op.op === 'remove') {
      let idx = op.index
      if (idx == null && op.exercise_id) {
        idx = day.exercises.findIndex((row) => row.exerciseId === op.exercise_id)
      }
      if (idx == null || idx < 0 || idx >= day.exercises.length) {
        return { ok: false, error: 'Could not find that exercise to remove.' }
      }
      day.exercises.splice(idx, 1)
      if (day.exercises.length === 0) {
        return { ok: false, error: 'A training day must keep at least one exercise.' }
      }
      continue
    }

    if (op.op === 'replace') {
      const idx = day.exercises.findIndex((row) => row.exerciseId === op.from_exercise_id)
      if (idx < 0) return { ok: false, error: 'Could not find the exercise to replace.' }
      const result = hydrateExercise(
        {
          exercise_id: op.to_exercise_id,
          sets: day.exercises[idx].sets,
          reps: day.exercises[idx].reps,
        },
        homeOnly,
      )
      if (!result.ok) return result
      day.exercises[idx] = result.exercise
      continue
    }

    if (op.op === 'reorder') {
      const from = op.from_index
      const to = op.to_index
      if (
        from < 0 ||
        to < 0 ||
        from >= day.exercises.length ||
        to >= day.exercises.length
      ) {
        return { ok: false, error: 'Reorder indexes are out of range.' }
      }
      const [moved] = day.exercises.splice(from, 1)
      day.exercises.splice(to, 0, moved)
      continue
    }

    if (op.op === 'set_targets') {
      let idx = op.index
      if (idx == null && op.exercise_id) {
        idx = day.exercises.findIndex((row) => row.exerciseId === op.exercise_id)
      }
      if (idx == null || idx < 0 || idx >= day.exercises.length) {
        return { ok: false, error: 'Could not find that exercise to update.' }
      }
      const current = day.exercises[idx]
      day.exercises[idx] = {
        ...current,
        sets: op.sets != null ? asPositiveInt(op.sets, current.sets, 1, 10) : current.sets,
        reps: op.reps?.trim() || current.reps,
      }
    }
  }

  return {
    ok: true,
    proposal: {
      ...base,
      id: crypto.randomUUID(),
      kind: 'update_split',
      days,
    },
  }
}

export function formatRepsFromTargets(min: number | null, max: number | null, cardio: boolean) {
  return formatTargetReps(min, max, cardio ? '30' : '8–12')
}
