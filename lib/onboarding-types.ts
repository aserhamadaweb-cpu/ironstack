import type { AppearanceMode } from '@/lib/theme'

/**
 * Onboarding payload stored in auth user_metadata (no new DB columns).
 * Profile row fields (display_name, username, theme_preference, language,
 * preferred_unit, height_cm, gender, current_weight_kg) are updated in parallel
 * when those values are set.
 */

export const ONBOARDING_PATH = '/onboarding'
export const HOME_PATH = '/dashboard/home'
export const ONBOARDING_COOKIE = 'ironstack-needs-onboarding'
export const ONBOARDING_META_VERSION = 3 as const

/** Lean first-run: appearance+language → identity → training → finish (+ AI split). */
export const ONBOARDING_STEPS = 4

export type { AppearanceMode }

export type AgeRange =
  | 'under_18'
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_plus'
  | 'prefer_not'

export type OnboardingGender = 'male' | 'female' | 'prefer_not'

export type FitnessGoal =
  | 'build_muscle'
  | 'lose_fat'
  | 'get_stronger'
  | 'endurance'
  | 'stay_active'
  | 'athletic'
  | 'other'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

export type WorkoutDuration =
  | 'under_30'
  | '30_45'
  | '45_60'
  | 'over_60'

export type TrainingLocation = 'home' | 'gym' | 'both'

export type EquipmentId =
  | 'bodyweight'
  | 'dumbbells'
  | 'bands'
  | 'kettlebells'
  | 'bench'
  | 'pullup_bar'
  | 'barbell'
  | 'machines'
  | 'other'

export type TrainingStyle =
  | 'full_body'
  | 'ppl'
  | 'upper_lower'
  | 'cardio'
  | 'strength'
  | 'mobility'
  | 'no_preference'

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'legs'
  | 'glutes'
  | 'full_body'

export type Weekday =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun'

/** Typed onboarding answers (metadata + mirrors of profile fields). */
export type OnboardingData = {
  /** 1–2 = legacy; 3 = appearance-first lean flow. */
  version: 1 | 2 | 3
  /** 1 appearance+language; 2 identity; 3 training; 4 finish / tour. */
  step: number
  displayName: string
  username: string
  appearance: AppearanceMode
  ageRange: AgeRange | null
  gender: OnboardingGender | null
  language: 'en' | 'ar' | null
  heightCm: number | null
  weightKg: number | null
  preferredUnit: 'kg' | 'lb'
  primaryGoal: FitnessGoal | null
  secondaryGoals: FitnessGoal[]
  fitnessLevel: FitnessLevel | null
  daysPerWeek: number | null
  workoutDuration: WorkoutDuration | null
  preferredDays: Weekday[]
  trainingLocation: TrainingLocation | null
  equipment: EquipmentId[]
  trainingStyles: TrainingStyle[]
  favoriteMuscleGroups: MuscleGroup[]
  avoidances: string
  limitations: string
}

export type OnboardingState = {
  completed: boolean
  /** Explicitly started incomplete flow (new signup). */
  incomplete: boolean
  data: OnboardingData
}

export function emptyOnboardingData(
  defaults?: Partial<OnboardingData>,
): OnboardingData {
  return {
    version: ONBOARDING_META_VERSION,
    step: 1,
    displayName: '',
    username: '',
    appearance: 'system',
    ageRange: null,
    gender: null,
    language: null,
    heightCm: null,
    weightKg: null,
    preferredUnit: 'kg',
    primaryGoal: null,
    secondaryGoals: [],
    fitnessLevel: null,
    daysPerWeek: null,
    workoutDuration: null,
    preferredDays: [],
    trainingLocation: null,
    equipment: [],
    trainingStyles: [],
    favoriteMuscleGroups: [],
    avoidances: '',
    limitations: '',
    ...defaults,
  }
}

export function clampOnboardingStep(step: unknown): number {
  const n = typeof step === 'number' ? step : Number(step)
  if (!Number.isFinite(n)) return 1
  return Math.min(ONBOARDING_STEPS, Math.max(1, Math.round(n)))
}

export function hasTrainingBasics(data: Pick<
  OnboardingData,
  | 'primaryGoal'
  | 'fitnessLevel'
  | 'daysPerWeek'
  | 'workoutDuration'
  | 'trainingLocation'
>): boolean {
  return Boolean(
    data.primaryGoal &&
      data.fitnessLevel &&
      data.daysPerWeek != null &&
      data.daysPerWeek >= 1 &&
      data.daysPerWeek <= 7 &&
      data.workoutDuration &&
      data.trainingLocation,
  )
}

/**
 * Map older onboarding progress onto the appearance-first 4-step flow (v3).
 * Fresh v3 progress (and signups with no blob yet) is left alone.
 */
export function resolveOnboardingFlowStep(data: OnboardingData): number {
  const clamped = clampOnboardingStep(data.step)
  if (data.version >= 3) return clamped

  const nameOk = data.displayName.trim().length >= 2
  const userOk = /^[a-z0-9_]{3,30}$/.test(data.username.trim())
  // Skip appearance (step 1) for mid-flow upgrades — they already picked theme/locale
  // at the gate or earlier; land them on the next incomplete screen.
  if (!nameOk || !userOk) return 2
  if (!hasTrainingBasics(data)) return 3
  return 4
}

const HOME_EQUIPMENT: EquipmentId[] = [
  'bodyweight',
  'dumbbells',
  'bands',
  'kettlebells',
  'bench',
  'pullup_bar',
  'other',
]

const GYM_EQUIPMENT: EquipmentId[] = [
  'bodyweight',
  'dumbbells',
  'bands',
  'kettlebells',
  'bench',
  'pullup_bar',
  'barbell',
  'machines',
  'other',
]

export function equipmentOptionsForLocation(
  location: TrainingLocation | null,
): EquipmentId[] {
  if (location === 'home') return HOME_EQUIPMENT
  if (location === 'gym') return GYM_EQUIPMENT
  return GYM_EQUIPMENT
}
