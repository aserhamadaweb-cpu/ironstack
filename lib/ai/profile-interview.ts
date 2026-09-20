/**
 * Guided choice interview for missing fitness-profile fields inside AI Coach.
 * Mirrors the Create-Split-with-AI step UX (choice buttons + optional number inputs).
 */

import type { OnboardingData } from '@/lib/onboarding-types'
import {
  type ProfileMissingField,
  labelMissingField,
} from '@/lib/profile-completeness'
import { displayToKg, isValidHeightCm, isValidWeightKg } from '@/lib/units'

export type ProfileInterviewChoice = {
  id: string
  /** Value written into onboarding / fitness profile. */
  value: string | number
}

export type ProfileInterviewStepDef = {
  field: ProfileMissingField
  kind: 'choice' | 'number'
  multi?: boolean
  /** For number steps: weight uses kg/lb; height always cm in storage. */
  numberKind?: 'weight' | 'height'
  choices?: ProfileInterviewChoice[]
}

export type ProfileInterviewStepAnswer = {
  choiceIds: string[]
  /** Free number for weight/height (in the unit shown). */
  numberValue: string
  unit: 'kg' | 'lb' | 'cm'
}

export type ProfileInterviewAnswers = Partial<
  Record<ProfileMissingField, ProfileInterviewStepAnswer>
>

const GOAL_CHOICES: ProfileInterviewChoice[] = [
  { id: 'build_muscle', value: 'build_muscle' },
  { id: 'lose_fat', value: 'lose_fat' },
  { id: 'get_stronger', value: 'get_stronger' },
  { id: 'endurance', value: 'endurance' },
  { id: 'stay_active', value: 'stay_active' },
  { id: 'athletic', value: 'athletic' },
  { id: 'other', value: 'other' },
]

const LEVEL_CHOICES: ProfileInterviewChoice[] = [
  { id: 'beginner', value: 'beginner' },
  { id: 'intermediate', value: 'intermediate' },
  { id: 'advanced', value: 'advanced' },
]

const DAYS_CHOICES: ProfileInterviewChoice[] = [2, 3, 4, 5, 6, 7].map((n) => ({
  id: `days_${n}`,
  value: n,
}))

const DURATION_CHOICES: ProfileInterviewChoice[] = [
  { id: 'under_30', value: 'under_30' },
  { id: '30_45', value: '30_45' },
  { id: '45_60', value: '45_60' },
  { id: 'over_60', value: 'over_60' },
]

const LOCATION_CHOICES: ProfileInterviewChoice[] = [
  { id: 'gym', value: 'gym' },
  { id: 'home', value: 'home' },
  { id: 'both', value: 'both' },
]

const GENDER_CHOICES: ProfileInterviewChoice[] = [
  { id: 'male', value: 'male' },
  { id: 'female', value: 'female' },
  { id: 'prefer_not', value: 'prefer_not' },
]

const AGE_CHOICES: ProfileInterviewChoice[] = [
  { id: 'under_18', value: 'under_18' },
  { id: '18_24', value: '18_24' },
  { id: '25_34', value: '25_34' },
  { id: '35_44', value: '35_44' },
  { id: '45_54', value: '45_54' },
  { id: '55_plus', value: '55_plus' },
  { id: 'prefer_not', value: 'prefer_not' },
]

const STEP_BY_FIELD: Record<ProfileMissingField, ProfileInterviewStepDef> = {
  weight: { field: 'weight', kind: 'number', numberKind: 'weight' },
  height: { field: 'height', kind: 'number', numberKind: 'height' },
  gender: { field: 'gender', kind: 'choice', choices: GENDER_CHOICES },
  age: { field: 'age', kind: 'choice', choices: AGE_CHOICES },
  primary_goal: { field: 'primary_goal', kind: 'choice', choices: GOAL_CHOICES },
  fitness_level: {
    field: 'fitness_level',
    kind: 'choice',
    choices: LEVEL_CHOICES,
  },
  days_per_week: {
    field: 'days_per_week',
    kind: 'choice',
    choices: DAYS_CHOICES,
  },
  workout_duration: {
    field: 'workout_duration',
    kind: 'choice',
    choices: DURATION_CHOICES,
  },
  training_location: {
    field: 'training_location',
    kind: 'choice',
    choices: LOCATION_CHOICES,
  },
}

/** Prefer training-relevant fields first when building a split. */
const FIELD_PRIORITY: ProfileMissingField[] = [
  'primary_goal',
  'fitness_level',
  'days_per_week',
  'workout_duration',
  'training_location',
  'weight',
  'height',
  'gender',
  'age',
]

export function orderProfileInterviewFields(
  fields: ProfileMissingField[],
): ProfileMissingField[] {
  const set = new Set(fields)
  return FIELD_PRIORITY.filter((f) => set.has(f))
}

export function getProfileInterviewStep(
  field: ProfileMissingField,
): ProfileInterviewStepDef {
  return STEP_BY_FIELD[field]
}

export function emptyStepAnswer(
  field: ProfileMissingField,
  preferredUnit: 'kg' | 'lb',
): ProfileInterviewStepAnswer {
  const step = STEP_BY_FIELD[field]
  if (step.kind === 'number' && step.numberKind === 'weight') {
    return { choiceIds: [], numberValue: '', unit: preferredUnit }
  }
  if (step.kind === 'number') {
    return { choiceIds: [], numberValue: '', unit: 'cm' }
  }
  return { choiceIds: [], numberValue: '', unit: preferredUnit }
}

export function isProfileInterviewStepComplete(
  field: ProfileMissingField,
  answer: ProfileInterviewStepAnswer | undefined,
): boolean {
  if (!answer) return false
  const step = STEP_BY_FIELD[field]
  if (step.kind === 'choice') {
    return answer.choiceIds.length > 0
  }
  const n = Number(answer.numberValue)
  if (!Number.isFinite(n) || n <= 0) return false
  if (step.numberKind === 'weight') {
    const kg =
      answer.unit === 'lb' ? displayToKg(n, 'lb') : displayToKg(n, 'kg')
    return isValidWeightKg(kg)
  }
  // height: treat number as cm (UI labels cm; imperial can type cm converted)
  return isValidHeightCm(n)
}

export function answersToOnboardingPatch(
  answers: ProfileInterviewAnswers,
): Partial<OnboardingData> {
  const patch: Partial<OnboardingData> = {}

  for (const [field, answer] of Object.entries(answers) as Array<
    [ProfileMissingField, ProfileInterviewStepAnswer]
  >) {
    if (!answer) continue
    const step = STEP_BY_FIELD[field]
    if (step.kind === 'choice') {
      const choice = step.choices?.find((c) => c.id === answer.choiceIds[0])
      if (!choice) continue
      switch (field) {
        case 'gender':
          patch.gender = choice.value as OnboardingData['gender']
          break
        case 'age':
          patch.ageRange = choice.value as OnboardingData['ageRange']
          break
        case 'primary_goal':
          patch.primaryGoal = choice.value as OnboardingData['primaryGoal']
          break
        case 'fitness_level':
          patch.fitnessLevel = choice.value as OnboardingData['fitnessLevel']
          break
        case 'days_per_week':
          patch.daysPerWeek = Number(choice.value)
          break
        case 'workout_duration':
          patch.workoutDuration =
            choice.value as OnboardingData['workoutDuration']
          break
        case 'training_location':
          patch.trainingLocation =
            choice.value as OnboardingData['trainingLocation']
          break
        default:
          break
      }
      continue
    }

    const n = Number(answer.numberValue)
    if (!Number.isFinite(n)) continue
    if (field === 'weight') {
      const unit = answer.unit === 'lb' ? 'lb' : 'kg'
      patch.weightKg = Math.round(displayToKg(n, unit) * 100) / 100
      patch.preferredUnit = unit
    } else if (field === 'height') {
      patch.heightCm = Math.round(n * 10) / 10
    }
  }

  return patch
}

export function summarizeInterviewFields(fields: ProfileMissingField[]): string {
  return fields.map(labelMissingField).join(', ')
}

export function isProfileInterviewPayload(
  value: unknown,
): value is {
  status: 'profile_interview' | 'pending_confirmation'
  interviewId: string
  fields: ProfileMissingField[]
  preferredUnit?: 'kg' | 'lb'
  resumePrompt?: string | null
} {
  if (!value || typeof value !== 'object') return false
  const row = value as {
    status?: string
    interviewId?: unknown
    fields?: unknown
  }
  return (
    (row.status === 'profile_interview' ||
      row.status === 'pending_confirmation') &&
    typeof row.interviewId === 'string' &&
    row.interviewId.length > 0 &&
    Array.isArray(row.fields) &&
    row.fields.length > 0
  )
}
