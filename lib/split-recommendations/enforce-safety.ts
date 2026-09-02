import type { Exercise } from '@/lib/exercises/types'
import { getExerciseById } from '@/lib/exercises/catalog'
import { resolveCatalogId, searchCatalogExercises } from '@/lib/ai/catalog-lookup'
import { normalizeKey } from '@/lib/exercises/normalizers'
import type { SplitProposal } from '@/lib/ai/action-types'
import {
  limitationText,
  shouldAvoidExercise,
} from './limitations'
import {
  buildAllowedEquipment,
  exerciseToRecommended,
  pickExerciseForSlot,
  pickExerciseForSlotRelaxed,
} from './exercise-picker'
import { buildVolumeProfile } from './volume'
import type {
  ExerciseSlotRole,
  RecommendationInput,
  RecommendedDay,
  RecommendedExercise,
  SplitRecommendation,
} from './types'

export type SafetySwapContext = {
  userPrompt: string
  requestedExerciseName?: string
}

/** Movement phrases the user might explicitly ask for in free text. */
const EXPLICIT_MOVEMENT_PATTERNS: Array<{
  pattern: RegExp
  role: ExerciseSlotRole
  label: string
}> = [
  {
    pattern: /overhead\s+press|military\s+press|\bohp\b|behind[\s-]the[\s-]neck\s+press/i,
    role: 'vertical_push',
    label: 'overhead pressing',
  },
  {
    pattern: /barbell\s+deadlift|conventional\s+deadlift|\bdeadlift\b/i,
    role: 'hinge',
    label: 'deadlifting',
  },
  {
    pattern: /barbell\s+squat|back\s+squat|\bsquat\b/i,
    role: 'squat',
    label: 'squatting',
  },
  {
    pattern: /upright\s+row/i,
    role: 'shoulder_accessory',
    label: 'upright rows',
  },
  {
    pattern: /skull\s*crusher|skullcrusher/i,
    role: 'tricep_accessory',
    label: 'skull crushers',
  },
]

export function detectExplicitUserRequests(prompt: string): Array<{
  role: ExerciseSlotRole
  label: string
  matched: string
}> {
  const out: Array<{ role: ExerciseSlotRole; label: string; matched: string }> =
    []
  for (const row of EXPLICIT_MOVEMENT_PATTERNS) {
    const match = prompt.match(row.pattern)
    if (match) {
      out.push({ role: row.role, label: row.label, matched: match[0] })
    }
  }
  return out
}

export function wouldAvoidByName(
  name: string,
  input: RecommendationInput,
): boolean {
  return shouldAvoidExercise(name, limitationText(input), input.seniorMode)
}

export function userAskedForAvoidedMovement(
  prompt: string,
  input: RecommendationInput,
): string[] {
  const warnings: string[] = []
  for (const req of detectExplicitUserRequests(prompt)) {
    const probe = pickRepresentativeNameForRole(req.role)
    if (probe && wouldAvoidByName(probe, input)) {
      warnings.push(
        `You asked for ${req.label}, but that conflicts with your profile limitations — we substituted a safer alternative.`,
      )
    }
  }
  return warnings
}

function pickRepresentativeNameForRole(role: ExerciseSlotRole): string | null {
  switch (role) {
    case 'vertical_push':
      return 'Overhead Press'
    case 'hinge':
      return 'Barbell Deadlift'
    case 'squat':
      return 'Barbell Squat'
    case 'shoulder_accessory':
      return 'Upright Row'
    case 'tricep_accessory':
      return 'Skull Crusher'
    default:
      return null
  }
}

export function resolveCatalogExerciseByName(
  name: string,
  allowed: Set<string>,
  input: RecommendationInput,
): { exercise: Exercise | null; warning: string | null } {
  const trimmed = name.trim()
  if (!trimmed) return { exercise: null, warning: null }

  let resolved = resolveCatalogId(trimmed)
  if (!resolved.id) {
    const hits = searchCatalogExercises({ query: trimmed, limit: 5 })
    if (hits.length === 1) {
      resolved = { id: hits[0].id, matches: [] }
    } else if (hits.length > 1) {
      const key = normalizeKey(trimmed)
      const exact = hits.find((h) => normalizeKey(h.name) === key)
      if (exact) resolved = { id: exact.id, matches: [] }
    }
  }

  if (!resolved.id) {
    if (resolved.matches.length > 1) {
      return {
        exercise: null,
        warning: `"${trimmed}" matched multiple catalog exercises — using the closest safe slot pick instead.`,
      }
    }
    return {
      exercise: null,
      warning: `"${trimmed}" is not in the exercise catalog — using the closest safe alternative.`,
    }
  }

  const catalog = getExerciseById(resolved.id)
  if (!catalog) {
    return {
      exercise: null,
      warning: `"${trimmed}" could not be loaded from the catalog.`,
    }
  }

  const eq = catalog.equipment.toLowerCase()
  const allowedEq = [...allowed].some(
    (key) => eq.includes(key) || key.includes(eq) || eq === 'body weight',
  )
  if (!allowedEq) {
    return {
      exercise: null,
      warning: `${catalog.name} needs ${catalog.equipment}, which is not in your available equipment — substituted a compatible exercise.`,
    }
  }

  if (wouldAvoidByName(catalog.name, input)) {
    return {
      exercise: null,
      warning: `${catalog.name} conflicts with your profile limitations — substituted a safer alternative.`,
    }
  }

  return { exercise: catalog, warning: null }
}

/** Re-pick with correct tier sets/reps after slot tier is known. */
export function safePickForSlotWithTier(
  role: ExerciseSlotRole,
  tier: 'main' | 'accessory' | 'finisher',
  input: RecommendationInput,
  allowed: Set<string>,
  usedIds: Set<string>,
  catalog: Exercise[],
  ctx?: SafetySwapContext,
): { exercise: RecommendedExercise | null; warnings: string[] } {
  const volume = buildVolumeProfile(
    input.fitnessLevel,
    input.workoutDuration,
    input.primaryGoal,
    input.seniorMode,
  )
  const warnings: string[] = []

  if (ctx?.requestedExerciseName) {
    const resolved = resolveCatalogExerciseByName(
      ctx.requestedExerciseName,
      allowed,
      input,
    )
    if (resolved.warning) warnings.push(resolved.warning)
    if (resolved.exercise) {
      if (usedIds.has(resolved.exercise.sourceId)) {
        warnings.push(
          `${resolved.exercise.name} was already scheduled — skipped duplicate.`,
        )
      } else {
        usedIds.add(resolved.exercise.sourceId)
        const sets = tier === 'main' ? volume.mainSets : volume.accessorySets
        const reps = tier === 'main' ? volume.mainReps : volume.accessoryReps
        return {
          exercise: exerciseToRecommended(resolved.exercise, sets, reps),
          warnings,
        }
      }
    }
  }

  const picked = pickExerciseForSlot(role, input, allowed, usedIds, catalog)
  if (!picked) {
    warnings.push(
      `Could not fill ${role.replace(/_/g, ' ')} with your equipment and limitations.`,
    )
    return { exercise: null, warnings }
  }

  const sets = tier === 'main' ? volume.mainSets : volume.accessorySets
  const reps = tier === 'main' ? volume.mainReps : volume.accessoryReps
  return {
    exercise: exerciseToRecommended(picked, sets, reps),
    warnings,
  }
}

/** Last-resort slot fill — relaxes injury swaps but keeps equipment and senior safety. */
export function safePickForSlotRelaxed(
  role: ExerciseSlotRole,
  tier: 'main' | 'accessory' | 'finisher',
  input: RecommendationInput,
  usedIds: Set<string>,
  catalog: Exercise[],
  options?: { gymEquipment?: boolean },
): { exercise: RecommendedExercise | null; warnings: string[] } {
  const volume = buildVolumeProfile(
    input.fitnessLevel,
    input.workoutDuration,
    input.primaryGoal,
    input.seniorMode,
  )
  const picked = pickExerciseForSlotRelaxed(
    role,
    input,
    usedIds,
    catalog,
    options,
  )
  if (!picked) {
    return {
      exercise: null,
      warnings: [
        `Could not fill ${role.replace(/_/g, ' ')} even with relaxed matching.`,
      ],
    }
  }
  const sets = tier === 'main' ? volume.mainSets : volume.accessorySets
  const reps = tier === 'main' ? volume.mainReps : volume.accessoryReps
  return {
    exercise: exerciseToRecommended(picked, sets, reps),
    warnings: [],
  }
}

export function enforceSafetyOnSchedule(
  schedule: RecommendedDay[],
  input: RecommendationInput,
  userPrompt: string,
): { schedule: RecommendedDay[]; warnings: string[] } {
  const warnings = [...userAskedForAvoidedMovement(userPrompt, input)]
  const limitText = limitationText(input)
  const allowed = buildAllowedEquipment(input)

  const next = schedule.map((day) => ({
    ...day,
    exercises: day.exercises.filter((ex) => {
      if (shouldAvoidExercise(ex.name, limitText, input.seniorMode)) {
        warnings.push(
          `Removed ${ex.name} — it conflicts with your profile limitations.`,
        )
        return false
      }

      const catalogRow = resolveCatalogId(ex.libraryId || ex.name)
      if (catalogRow.id) {
        const row = getExerciseById(catalogRow.id)
        if (row) {
          const eq = row.equipment.toLowerCase()
          const ok = [...allowed].some(
            (key) => eq.includes(key) || key.includes(eq) || eq === 'body weight',
          )
          if (!ok) {
            warnings.push(
              `${ex.name} was removed — ${row.equipment} is not in your available equipment.`,
            )
            return false
          }
        }
      }

      return true
    }),
  }))

  return { schedule: next, warnings: [...new Set(warnings)] }
}

export function userPromptFromSplitProposal(
  proposal: SplitProposal,
  hint?: string,
): string {
  return [
    hint,
    proposal.name,
    proposal.description,
    ...proposal.assumptions,
    ...proposal.days.flatMap((day) => day.exercises.map((ex) => ex.name)),
  ]
    .filter(Boolean)
    .join(' ')
}

function proposalScheduleFromSplit(proposal: SplitProposal): RecommendedDay[] {
  return proposal.days.map((day) => ({
    name: day.name,
    subtitle: day.subtitle ?? '',
    muscleFocus: [],
    exercises: day.exercises.map((ex) => ({
      libraryId: ex.exerciseId,
      name: ex.name,
      muscles: [ex.muscle].filter(Boolean),
      image: null,
      category: 'strength',
      sets: ex.sets,
      reps: ex.reps,
    })),
  }))
}

function applySafeScheduleToProposal(
  proposal: SplitProposal,
  safeSchedule: RecommendedDay[],
): SplitProposal {
  const days = proposal.days
    .map((day, index) => {
      const safe = safeSchedule[index]
      if (!safe) return day
      const safeIds = new Set(safe.exercises.map((ex) => ex.libraryId))
      return {
        ...day,
        exercises: day.exercises.filter((ex) => safeIds.has(ex.exerciseId)),
      }
    })
    .filter((day) => day.exercises.length > 0)

  return {
    ...proposal,
    days,
    daysPerWeek: days.length > 0 ? days.length : proposal.daysPerWeek,
  }
}

/** Filter a coach SplitProposal through shared profile safety rules. */
export function enforceSafetyOnSplitProposal(
  proposal: SplitProposal,
  input: RecommendationInput,
  userPrompt: string,
): { proposal: SplitProposal; warnings: string[] } {
  const schedule = proposalScheduleFromSplit(proposal)
  const { schedule: safeSchedule, warnings } = enforceSafetyOnSchedule(
    schedule,
    input,
    userPrompt,
  )

  const allWarnings = [...warnings]

  if (input.seniorMode && proposal.daysPerWeek > input.daysPerWeek) {
    allWarnings.push(
      `This plan has ${proposal.daysPerWeek} training days — your profile recommends at most ${input.daysPerWeek} for recovery.`,
    )
  }

  if (
    input.seniorMode &&
    (/bro[\s-]?split/i.test(userPrompt) ||
      /bro[\s-]?split/i.test(proposal.name) ||
      /bro[\s-]?split/i.test(proposal.description))
  ) {
    allWarnings.push(
      'High-volume bro splits are not recommended in senior mode — review day count and exercise selection before saving.',
    )
  }

  const deduped = [...new Set(allWarnings.filter(Boolean))]

  return {
    proposal: {
      ...applySafeScheduleToProposal(proposal, safeSchedule),
      warnings: deduped,
    },
    warnings: deduped,
  }
}

/** Convert a validated coach SplitProposal into a SplitRecommendation for the shared card UI. */
export function proposalToSplitRecommendation(
  proposal: SplitProposal,
  input: RecommendationInput,
  options: {
    userPrompt: string
    rationale?: string
    extraWarnings?: string[]
  },
): SplitRecommendation {
  const schedule: RecommendedDay[] = proposal.days.map((day) => ({
    name: day.name,
    subtitle: day.subtitle ?? '',
    muscleFocus: [],
    exercises: day.exercises.map((ex) => ({
      libraryId: ex.exerciseId,
      name: ex.name,
      muscles: [ex.muscle].filter(Boolean),
      image: null,
      category: 'strength',
      sets: ex.sets,
      reps: ex.reps,
    })),
  }))

  const { schedule: safeSchedule, warnings } = enforceSafetyOnSchedule(
    schedule,
    input,
    options.userPrompt,
  )

  const allWarnings = [
    ...(options.extraWarnings ?? []),
    ...warnings,
    ...(proposal.assumptions ?? []),
  ]

  return {
    id: `custom_ai_${proposal.id}`,
    templateId: 'custom_ai',
    name: proposal.name,
    typeLabel: 'Custom',
    daysPerWeek: proposal.daysPerWeek,
    rationale:
      options.rationale ??
      proposal.description ??
      'Built from your description with catalog exercises matched to your profile.',
    score: 0,
    schedule: safeSchedule,
    warnings: [...new Set(allWarnings.filter(Boolean))],
  }
}
