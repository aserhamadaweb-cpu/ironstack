import type { Exercise } from '@/lib/exercises/types'
import { loadExerciseCatalog } from '@/lib/exercises/catalog'
import { SLOT_CANDIDATES, SLOT_MUSCLE_HINTS } from './exercise-slots'
import {
  limitationText,
  preferredAlternatives,
  shouldAvoidExercise,
} from './limitations'
import type { ExerciseSlotRole, RecommendationInput } from './types'
import { resolveAllowedEquipment, hasPullupBar } from './equipment'

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function equipmentAllowed(exercise: Exercise, allowed: Set<string>): boolean {
  const eq = exercise.equipment.toLowerCase()
  if (allowed.has(eq)) return true
  if (eq === 'body weight' && allowed.has('body weight')) return true
  for (const key of allowed) {
    if (eq.includes(key) || key.includes(eq)) return true
  }
  return false
}

function muscleMatches(exercise: Exercise, hints: readonly string[]): boolean {
  const blob = normalizeName(
    `${exercise.muscleGroup} ${exercise.target} ${exercise.bodyPart} ${exercise.secondaryMuscles.join(' ')}`,
  )
  return hints.some((hint) => blob.includes(normalizeName(hint)))
}

function nameMatchesCandidate(name: string, candidate: string): boolean {
  const n = normalizeName(name)
  const c = normalizeName(candidate)
  return n.includes(c) || c.includes(n)
}

function scoreExercise(
  exercise: Exercise,
  role: ExerciseSlotRole,
  limitText: string,
  seniorMode: boolean,
  preferNames: string[],
): number {
  let score = 0
  const candidates = SLOT_CANDIDATES[role]
  for (let i = 0; i < candidates.length; i++) {
    if (nameMatchesCandidate(exercise.name, candidates[i]!)) {
      score += 100 - i * 5
      break
    }
  }
  if (muscleMatches(exercise, SLOT_MUSCLE_HINTS[role])) score += 20
  for (let i = 0; i < preferNames.length; i++) {
    if (nameMatchesCandidate(exercise.name, preferNames[i]!)) {
      score += 40 - i
    }
  }
  if (shouldAvoidExercise(exercise.name, limitText, seniorMode)) score -= 200
  if (role === 'vertical_pull' && /assisted|band/i.test(exercise.name)) {
    score += seniorMode ? 15 : 5
  }
  return score
}

export function pickExerciseForSlot(
  role: ExerciseSlotRole,
  input: RecommendationInput,
  allowed: Set<string>,
  usedSourceIds: Set<string>,
  catalog?: Exercise[],
): Exercise | null {
  return pickExerciseForSlotInternal(
    role,
    input,
    allowed,
    usedSourceIds,
    catalog,
    'strict',
  )
}

/** Relaxed matching when strict profile filters leave no candidates. */
export function pickExerciseForSlotRelaxed(
  role: ExerciseSlotRole,
  input: RecommendationInput,
  usedSourceIds: Set<string>,
  catalog: Exercise[],
  options?: { gymEquipment?: boolean },
): Exercise | null {
  const allowed = options?.gymEquipment
    ? resolveAllowedEquipment('gym', [])
    : buildAllowedEquipment(input)
  return pickExerciseForSlotInternal(
    role,
    input,
    allowed,
    usedSourceIds,
    catalog,
    'relaxed',
  )
}

function pickExerciseForSlotInternal(
  role: ExerciseSlotRole,
  input: RecommendationInput,
  allowed: Set<string>,
  usedSourceIds: Set<string>,
  catalog: Exercise[] | undefined,
  mode: 'strict' | 'relaxed',
): Exercise | null {
  const all = catalog ?? loadExerciseCatalog()
  const limitText = limitationText(input)
  const preferNames = preferredAlternatives(limitText, input.seniorMode)

  if (role === 'vertical_pull' && !hasPullupBar(input.equipment, input.trainingLocation)) {
    allowed = new Set(allowed)
    // Pulldowns need cable or band at minimum.
    if (![...allowed].some((e) => /cable|band|machine|assisted/.test(e))) {
      allowed.add('cable')
      allowed.add('band')
    }
  }

  const ranked = all
    .filter((ex) => {
      if (usedSourceIds.has(ex.sourceId)) return false
      if (!equipmentAllowed(ex, allowed)) return false
      if (mode === 'strict' && shouldAvoidExercise(ex.name, limitText, input.seniorMode)) {
        return false
      }
      if (mode === 'relaxed' && input.seniorMode) {
        if (shouldAvoidExercise(ex.name, 'joint-friendly low-impact', true)) return false
      }
      if (role === 'cardio_finisher') {
        if (
          ex.category !== 'cardio' &&
          !/burpee|climber|jump|rope|run|walk|jack|sprint|mountain|ski|step/i.test(
            ex.name,
          )
        ) {
          return false
        }
      }
      if (role !== 'cardio_finisher' && ex.category === 'cardio') return false
      return true
    })
    .map((ex) => ({
      ex,
      score: scoreExercise(ex, role, limitText, input.seniorMode, preferNames),
    }))
    .filter((row) => row.score > (mode === 'relaxed' ? -150 : -50))
    .sort((a, b) => b.score - a.score)

  const pick = ranked[0]?.ex ?? null
  if (pick) usedSourceIds.add(pick.sourceId)
  return pick
}

export function exerciseToRecommended(
  exercise: Exercise,
  sets: number,
  reps: string,
  isFinisher = false,
) {
  return {
    libraryId: exercise.sourceId,
    name: exercise.name,
    muscles: [
      exercise.muscleGroup,
      ...exercise.secondaryMuscles.slice(0, 2),
    ].filter(Boolean),
    image: exercise.image || exercise.gifUrl || null,
    category: exercise.category,
    sets,
    reps,
    isFinisher,
  }
}

export function buildAllowedEquipment(input: RecommendationInput): Set<string> {
  return resolveAllowedEquipment(input.trainingLocation, input.equipment)
}
