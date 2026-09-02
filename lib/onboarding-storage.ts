import type { User } from '@supabase/supabase-js'
import {
  clampOnboardingStep,
  emptyOnboardingData,
  type AgeRange,
  type EquipmentId,
  type FitnessGoal,
  type FitnessLevel,
  type MuscleGroup,
  type OnboardingData,
  type OnboardingGender,
  type OnboardingState,
  type TrainingLocation,
  type TrainingStyle,
  type Weekday,
  type WorkoutDuration,
} from '@/lib/onboarding-types'
import { isAppearanceMode } from '@/lib/theme'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

const AGE_RANGES = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_plus',
  'prefer_not',
] as const satisfies readonly AgeRange[]

const GOALS = [
  'build_muscle',
  'lose_fat',
  'get_stronger',
  'endurance',
  'stay_active',
  'athletic',
  'other',
] as const satisfies readonly FitnessGoal[]

const LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
] as const satisfies readonly FitnessLevel[]

const DURATIONS = [
  'under_30',
  '30_45',
  '45_60',
  'over_60',
] as const satisfies readonly WorkoutDuration[]

const LOCATIONS = ['home', 'gym', 'both'] as const satisfies readonly TrainingLocation[]

const EQUIPMENT = [
  'bodyweight',
  'dumbbells',
  'bands',
  'kettlebells',
  'bench',
  'pullup_bar',
  'barbell',
  'machines',
  'other',
] as const satisfies readonly EquipmentId[]

const STYLES = [
  'full_body',
  'ppl',
  'upper_lower',
  'cardio',
  'strength',
  'mobility',
  'no_preference',
] as const satisfies readonly TrainingStyle[]

const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'legs',
  'glutes',
  'full_body',
] as const satisfies readonly MuscleGroup[]

const WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const satisfies readonly Weekday[]

function parseOnboardingBlob(raw: unknown): Partial<OnboardingData> {
  if (!raw) return {}
  let obj: Record<string, unknown> = {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        obj = parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>
  } else {
    return {}
  }

  const preferredUnit =
    obj.preferredUnit === 'lb' ||
    obj.preferred_unit === 'lb' ||
    obj.preferredUnit === 'kg' ||
    obj.preferred_unit === 'kg'
      ? obj.preferredUnit === 'lb' || obj.preferred_unit === 'lb'
        ? 'lb'
        : 'kg'
      : undefined

  return {
    step: clampOnboardingStep(obj.step),
    displayName: asString(obj.displayName ?? obj.display_name),
    username: asString(obj.username).toLowerCase().replace(/[^a-z0-9_]/g, ''),
    appearance: isAppearanceMode(obj.appearance) ? obj.appearance : undefined,
    ageRange: pickEnum(obj.ageRange ?? obj.age_range, AGE_RANGES),
    gender: pickEnum(obj.gender, [
      'male',
      'female',
      'prefer_not',
    ] as const satisfies readonly OnboardingGender[]),
    language:
      obj.language === 'en' || obj.language === 'ar' ? obj.language : null,
    heightCm: asNumberOrNull(obj.heightCm ?? obj.height_cm),
    weightKg: asNumberOrNull(obj.weightKg ?? obj.weight_kg),
    ...(preferredUnit ? { preferredUnit } : {}),
    primaryGoal: pickEnum(obj.primaryGoal ?? obj.primary_goal, GOALS),
    secondaryGoals: asStringArray(obj.secondaryGoals ?? obj.secondary_goals)
      .map((g) => pickEnum(g, GOALS))
      .filter((g): g is FitnessGoal => Boolean(g)),
    fitnessLevel: pickEnum(obj.fitnessLevel ?? obj.fitness_level, LEVELS),
    daysPerWeek: asNumberOrNull(obj.daysPerWeek ?? obj.days_per_week),
    workoutDuration: pickEnum(
      obj.workoutDuration ?? obj.workout_duration,
      DURATIONS,
    ),
    preferredDays: asStringArray(obj.preferredDays ?? obj.preferred_days)
      .map((d) => pickEnum(d, WEEKDAYS))
      .filter((d): d is Weekday => Boolean(d)),
    trainingLocation: pickEnum(
      obj.trainingLocation ?? obj.training_location,
      LOCATIONS,
    ),
    equipment: asStringArray(obj.equipment)
      .map((e) => pickEnum(e, EQUIPMENT))
      .filter((e): e is EquipmentId => Boolean(e)),
    trainingStyles: asStringArray(obj.trainingStyles ?? obj.training_styles)
      .map((s) => pickEnum(s, STYLES))
      .filter((s): s is TrainingStyle => Boolean(s)),
    favoriteMuscleGroups: asStringArray(
      obj.favoriteMuscleGroups ?? obj.favorite_muscle_groups,
    )
      .map((m) => pickEnum(m, MUSCLES))
      .filter((m): m is MuscleGroup => Boolean(m)),
    avoidances: asString(obj.avoidances),
    limitations: asString(obj.limitations),
  }
}

/**
 * Read onboarding state from auth user_metadata.
 * Missing `onboarding_completed` → treat as complete (existing accounts).
 */
export function readOnboardingState(
  user: User | null | undefined,
  profileHints?: {
    display_name?: string | null
    username?: string | null
    preferred_unit?: 'kg' | 'lb' | null
    height_cm?: number | null
    current_weight_kg?: number | null
    gender?: 'male' | 'female' | null
    language?: 'en' | 'ar' | null
    theme_preference?: 'dark' | 'light' | null
  },
): OnboardingState {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const completedFlag = meta.onboarding_completed
  const incomplete = completedFlag === false
  const completed = completedFlag === true || completedFlag == null

  const fromBlob = parseOnboardingBlob(meta.onboarding_v1 ?? meta.onboarding)

  const displayName =
    fromBlob.displayName ||
    asString(meta.display_name) ||
    profileHints?.display_name ||
    user?.email?.split('@')[0] ||
    ''

  const username =
    fromBlob.username ||
    asString(meta.username) ||
    profileHints?.username ||
    ''

  const appearance =
    (isAppearanceMode(meta.appearance) && meta.appearance) ||
    fromBlob.appearance ||
    (profileHints?.theme_preference === 'light' ||
    profileHints?.theme_preference === 'dark'
      ? profileHints.theme_preference
      : 'system')

  const data = emptyOnboardingData({
    ...fromBlob,
    step: clampOnboardingStep(
      fromBlob.step ?? meta.onboarding_step ?? (incomplete ? 1 : 1),
    ),
    displayName,
    username: String(username).toLowerCase().replace(/[^a-z0-9_]/g, ''),
    appearance,
    preferredUnit:
      fromBlob.preferredUnit ??
      profileHints?.preferred_unit ??
      'kg',
    heightCm: fromBlob.heightCm ?? profileHints?.height_cm ?? null,
    weightKg: fromBlob.weightKg ?? profileHints?.current_weight_kg ?? null,
    gender:
      fromBlob.gender ??
      (profileHints?.gender === 'male' || profileHints?.gender === 'female'
        ? profileHints.gender
        : null),
    language: fromBlob.language ?? profileHints?.language ?? null,
  })

  return {
    completed: completed && !incomplete ? true : completedFlag === true,
    incomplete,
    data,
  }
}

export function userNeedsOnboarding(
  user: User | null | undefined,
): boolean {
  if (!user || user.is_anonymous) return false
  return user.user_metadata?.onboarding_completed === false
}

/** Metadata patch for auth.updateUser — does not touch unrelated keys. */
export function buildOnboardingMetadataPatch(
  data: OnboardingData,
  completed: boolean,
): Record<string, unknown> {
  const blob: OnboardingData = {
    ...data,
    version: 1,
    step: clampOnboardingStep(data.step),
    displayName: data.displayName.trim().replace(/\s+/g, ' '),
    username: data.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
    avoidances: data.avoidances.trim().slice(0, 500),
    limitations: data.limitations.trim().slice(0, 500),
  }

  return {
    onboarding_completed: completed,
    onboarding_step: blob.step,
    onboarding_v1: blob,
    display_name: blob.displayName || undefined,
    username: blob.username || undefined,
    appearance: blob.appearance,
  }
}

export function summarizeOnboarding(data: OnboardingData): {
  goalLine: string | null
  scheduleLine: string | null
  placeLine: string | null
} {
  return {
    goalLine: data.primaryGoal,
    scheduleLine:
      data.daysPerWeek != null
        ? `${data.daysPerWeek}|${data.workoutDuration ?? ''}`
        : null,
    placeLine:
      data.trainingLocation != null
        ? `${data.trainingLocation}|${data.equipment.join(',')}`
        : null,
  }
}
