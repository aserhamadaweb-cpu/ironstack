import type {
  AgeRange,
  EquipmentId,
  FitnessGoal,
  FitnessLevel,
  MuscleGroup,
  OnboardingData,
  TrainingLocation,
  TrainingStyle,
  WorkoutDuration,
} from '@/lib/onboarding-types'

export type SplitTemplateId =
  | 'full_body'
  | 'full_body_4'
  | 'upper_lower'
  | 'upper_lower_3'
  | 'ppl_6'
  | 'ppl_5'
  | 'bro_5'
  | 'strength_fb'
  | 'hybrid_metcon'
  | 'home_minimal'
  | 'custom_ai'
  | 'arnold'
  | 'fbeod'
  | 'pro_split'
  | 'anterior_posterior'

export type RecommendationInput = {
  primaryGoal: FitnessGoal
  secondaryGoals: FitnessGoal[]
  fitnessLevel: FitnessLevel
  /** Effective days after age cap (may be lower than stated preference). */
  daysPerWeek: number
  statedDaysPerWeek: number
  workoutDuration: WorkoutDuration
  trainingLocation: TrainingLocation
  equipment: EquipmentId[]
  trainingStyles: TrainingStyle[]
  favoriteMuscleGroups: MuscleGroup[]
  avoidances: string
  limitations: string
  ageRange: AgeRange | null
  /** True when age 55+ adjustments apply. */
  seniorMode: boolean
}

export type ExerciseSlotRole =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'quad_accessory'
  | 'ham_accessory'
  | 'glute_accessory'
  | 'chest_accessory'
  | 'shoulder_accessory'
  | 'bicep_accessory'
  | 'tricep_accessory'
  | 'core'
  | 'calf'
  | 'cardio_finisher'

export type TemplateDaySlot = {
  role: ExerciseSlotRole
  tier: 'main' | 'accessory' | 'finisher'
}

export type TemplateDayDef = {
  name: string
  subtitle: string
  muscleFocus: string[]
  slots: TemplateDaySlot[]
}

export type SplitTemplateDef = {
  id: SplitTemplateId
  name: string
  typeLabel: string
  description: string
  daysPerWeek: number
  /** Minimum effective days to include this template. */
  minDays: number
  maxDays: number
  requiresGym: boolean
  minLevel: FitnessLevel
  /** Block entirely in senior mode. */
  blockedSenior: boolean
  days: TemplateDayDef[]
}

export type RecommendedExercise = {
  libraryId: string
  name: string
  muscles: string[]
  image: string | null
  category: string
  sets: number
  reps: string
  isFinisher?: boolean
}

export type RecommendedDay = {
  name: string
  subtitle: string
  muscleFocus: string[]
  exercises: RecommendedExercise[]
  finisherNote?: string
}

export type SplitRecommendation = {
  id: string
  templateId: SplitTemplateId
  name: string
  typeLabel: string
  daysPerWeek: number
  rationale: string
  score: number
  schedule: RecommendedDay[]
  /** Safety/substitution notes for AI-custom programs. */
  warnings?: string[]
}

export function inputFromOnboarding(data: OnboardingData): RecommendationInput | null {
  if (
    !data.primaryGoal ||
    !data.fitnessLevel ||
    data.daysPerWeek == null ||
    !data.workoutDuration ||
    !data.trainingLocation
  ) {
    return null
  }

  return buildRecommendationInput(data)
}

/** Fills sensible defaults for accounts missing optional onboarding fitness fields. */
export function inputFromOnboardingWithDefaults(
  data: OnboardingData,
): RecommendationInput {
  const merged: OnboardingData = {
    ...data,
    primaryGoal: data.primaryGoal ?? 'build_muscle',
    fitnessLevel: data.fitnessLevel ?? 'beginner',
    daysPerWeek: data.daysPerWeek ?? 3,
    workoutDuration: data.workoutDuration ?? '30_45',
    trainingLocation: data.trainingLocation ?? 'gym',
    secondaryGoals: data.secondaryGoals ?? [],
    equipment: data.equipment ?? [],
    trainingStyles: data.trainingStyles ?? [],
    favoriteMuscleGroups: data.favoriteMuscleGroups ?? [],
    avoidances: data.avoidances ?? '',
    limitations: data.limitations ?? '',
  }
  return buildRecommendationInput(merged)
}

function buildRecommendationInput(data: OnboardingData): RecommendationInput {
  const seniorMode = data.ageRange === '55_plus'

  let daysPerWeek = data.daysPerWeek ?? 3
  if (daysPerWeek < 1) daysPerWeek = 3
  if (seniorMode) {
    daysPerWeek = Math.min(daysPerWeek, 5)
  }

  return {
    primaryGoal: data.primaryGoal!,
    secondaryGoals: data.secondaryGoals,
    fitnessLevel: data.fitnessLevel!,
    daysPerWeek,
    statedDaysPerWeek: data.daysPerWeek ?? daysPerWeek,
    workoutDuration: data.workoutDuration!,
    trainingLocation: data.trainingLocation!,
    equipment: data.equipment,
    trainingStyles: data.trainingStyles,
    favoriteMuscleGroups: data.favoriteMuscleGroups,
    avoidances: data.avoidances,
    limitations: data.limitations,
    ageRange: data.ageRange,
    seniorMode,
  }
}
