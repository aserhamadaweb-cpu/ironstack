import type { OnboardingData } from '@/lib/onboarding-types'

/** Fields we nudge athletes to fill for better coaching / programming. */
export type ProfileMissingField =
  | 'weight'
  | 'height'
  | 'gender'
  | 'age'
  | 'primary_goal'
  | 'fitness_level'
  | 'days_per_week'
  | 'workout_duration'
  | 'training_location'

export type ProfileCompletenessInput = {
  weightKg?: number | null
  heightCm?: number | null
  gender?: string | null
  birthDate?: string | null
  ageRange?: string | null
  primaryGoal?: string | null
  fitnessLevel?: string | null
  daysPerWeek?: number | null
  workoutDuration?: string | null
  trainingLocation?: string | null
}

const FIELD_LABELS: Record<ProfileMissingField, string> = {
  weight: 'body weight',
  height: 'height',
  gender: 'sex',
  age: 'age',
  primary_goal: 'training goal',
  fitness_level: 'fitness level',
  days_per_week: 'days per week',
  workout_duration: 'session length',
  training_location: 'training location',
}

export function labelMissingField(field: ProfileMissingField): string {
  return FIELD_LABELS[field]
}

export function getMissingProfileFields(
  input: ProfileCompletenessInput,
): ProfileMissingField[] {
  const missing: ProfileMissingField[] = []

  if (input.weightKg == null || !Number.isFinite(Number(input.weightKg))) {
    missing.push('weight')
  }
  if (input.heightCm == null || !Number.isFinite(Number(input.heightCm))) {
    missing.push('height')
  }
  if (!input.gender) {
    missing.push('gender')
  }
  if (!input.birthDate && !input.ageRange) {
    missing.push('age')
  }
  if (!input.primaryGoal) missing.push('primary_goal')
  if (!input.fitnessLevel) missing.push('fitness_level')
  if (input.daysPerWeek == null || !Number.isFinite(Number(input.daysPerWeek))) {
    missing.push('days_per_week')
  }
  if (!input.workoutDuration) missing.push('workout_duration')
  if (!input.trainingLocation) missing.push('training_location')

  return missing
}

export function completenessFromOnboarding(
  onboarding: OnboardingData,
  extras?: {
    weightKg?: number | null
    heightCm?: number | null
    gender?: string | null
    birthDate?: string | null
  },
): ProfileCompletenessInput {
  return {
    weightKg: extras?.weightKg ?? onboarding.weightKg,
    heightCm: extras?.heightCm ?? onboarding.heightCm,
    gender: extras?.gender ?? onboarding.gender,
    birthDate: extras?.birthDate ?? null,
    ageRange: onboarding.ageRange,
    primaryGoal: onboarding.primaryGoal,
    fitnessLevel: onboarding.fitnessLevel,
    daysPerWeek: onboarding.daysPerWeek,
    workoutDuration: onboarding.workoutDuration,
    trainingLocation: onboarding.trainingLocation,
  }
}

export function isProfileIncomplete(input: ProfileCompletenessInput): boolean {
  return getMissingProfileFields(input).length > 0
}

export const FITNESS_PROFILE_HREF = '/dashboard/fitness-profile'
