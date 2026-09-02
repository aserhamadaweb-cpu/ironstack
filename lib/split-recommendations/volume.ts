import type { FitnessGoal, FitnessLevel, WorkoutDuration } from '@/lib/onboarding-types'

export type VolumeProfile = {
  mainSets: number
  accessorySets: number
  maxExercises: number
  mainReps: string
  accessoryReps: string
}

const LEVEL_BASE: Record<
  FitnessLevel,
  Omit<VolumeProfile, 'mainReps' | 'accessoryReps' | 'maxExercises'>
> = {
  beginner: { mainSets: 3, accessorySets: 2 },
  intermediate: { mainSets: 4, accessorySets: 3 },
  advanced: { mainSets: 4, accessorySets: 3 },
}

const DURATION_CAP: Record<WorkoutDuration, number> = {
  under_30: 5,
  '30_45': 6,
  '45_60': 7,
  over_60: 8,
}

function repsForGoal(goal: FitnessGoal, tier: 'main' | 'accessory'): string {
  switch (goal) {
    case 'get_stronger':
      return tier === 'main' ? '4–6' : '6–8'
    case 'build_muscle':
      return tier === 'main' ? '6–10' : '10–15'
    case 'lose_fat':
    case 'endurance':
      return tier === 'main' ? '8–12' : '12–15'
    case 'athletic':
    case 'stay_active':
      return tier === 'main' ? '6–10' : '10–12'
    default:
      return tier === 'main' ? '8–10' : '10–12'
  }
}

export function buildVolumeProfile(
  level: FitnessLevel,
  duration: WorkoutDuration,
  primaryGoal: FitnessGoal,
  seniorMode: boolean,
): VolumeProfile {
  const base = LEVEL_BASE[level]
  let accessorySets = base.accessorySets
  if (seniorMode) {
    accessorySets = Math.max(1, accessorySets - 1)
  }

  const maxExercises = Math.min(
    DURATION_CAP[duration],
    level === 'beginner' && duration === 'under_30' ? 4 : DURATION_CAP[duration],
  )

  return {
    mainSets: base.mainSets,
    accessorySets,
    maxExercises,
    mainReps: repsForGoal(primaryGoal, 'main'),
    accessoryReps: repsForGoal(primaryGoal, 'accessory'),
  }
}
