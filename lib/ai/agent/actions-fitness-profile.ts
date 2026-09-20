import { saveOnboardingProgressAction } from '@/lib/data/onboarding-actions'
import { createClient } from '@/lib/supabase/server'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import {
  type AgeRange,
  type EquipmentId,
  type FitnessGoal,
  type FitnessLevel,
  type OnboardingData,
  type OnboardingGender,
  type TrainingLocation,
  type WorkoutDuration,
} from '@/lib/onboarding-types'
import { displayToKg, isValidHeightCm, isValidWeightKg } from '@/lib/units'
import { FITNESS_PROFILE_HREF } from '@/lib/profile-completeness'
import {
  defineAgentAction,
  fail,
  type AnyAgentAction,
  type JsonValue,
} from '@/lib/ai/agent/types'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value)
  return Number.NaN
}

const GOALS = new Set<FitnessGoal>([
  'build_muscle',
  'lose_fat',
  'get_stronger',
  'endurance',
  'stay_active',
  'athletic',
  'other',
])

const LEVELS = new Set<FitnessLevel>(['beginner', 'intermediate', 'advanced'])

const DURATIONS = new Set<WorkoutDuration>([
  'under_30',
  '30_45',
  '45_60',
  'over_60',
])

const LOCATIONS = new Set<TrainingLocation>(['home', 'gym', 'both'])

const AGES = new Set<AgeRange>([
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_plus',
  'prefer_not',
])

const EQUIPMENT = new Set<EquipmentId>([
  'bodyweight',
  'dumbbells',
  'bands',
  'kettlebells',
  'bench',
  'pullup_bar',
  'barbell',
  'machines',
  'other',
])

type FitnessPatch = Partial<
  Pick<
    OnboardingData,
    | 'heightCm'
    | 'weightKg'
    | 'gender'
    | 'ageRange'
    | 'primaryGoal'
    | 'fitnessLevel'
    | 'daysPerWeek'
    | 'workoutDuration'
    | 'trainingLocation'
    | 'equipment'
    | 'avoidances'
    | 'limitations'
  >
>

function parseEquipment(raw: unknown): EquipmentId[] | null {
  if (!Array.isArray(raw)) return null
  const out: EquipmentId[] = []
  for (const item of raw) {
    const id = asString(item).toLowerCase().replace(/-/g, '_') as EquipmentId
    if (EQUIPMENT.has(id)) out.push(id)
  }
  return out
}

async function loadCurrent(userId: string): Promise<OnboardingData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, username, preferred_unit, height_cm, current_weight_kg, gender, language, theme_preference, avatar_url',
    )
    .eq('id', userId)
    .maybeSingle()
  return onboardingDataFromUser(user, profile ?? undefined)
}

const updateFitnessProfile = defineAgentAction<{
  patch: FitnessPatch
  changed: string[]
}>({
  name: 'update_fitness_profile',
  domain: 'body',
  async prepare(ctx, raw) {
    const current = await loadCurrent(ctx.userId)
    if (!current) return fail('Could not load your fitness profile.')

    const patch: FitnessPatch = {}
    const changed: string[] = []

    const rawHeight = asNumber(
      raw.height_cm !== undefined ? raw.height_cm : raw.heightCm,
    )
    if (Number.isFinite(rawHeight)) {
      const heightCm = Math.round(rawHeight * 10) / 10
      if (!isValidHeightCm(heightCm)) {
        return fail('Height has to be between 100 and 250 cm.')
      }
      if (heightCm !== current.heightCm) {
        patch.heightCm = heightCm
        changed.push(
          `Height: ${current.heightCm ?? 'not set'} cm → ${heightCm} cm`,
        )
      }
    }

    const rawWeight = asNumber(raw.weight !== undefined ? raw.weight : raw.weight_kg)
    if (Number.isFinite(rawWeight)) {
      const unit = asString(raw.unit).toLowerCase() === 'lb' ? 'lb' : 'kg'
      const weightKg = Math.round(displayToKg(rawWeight, unit) * 100) / 100
      if (!isValidWeightKg(weightKg)) {
        return fail('Body weight has to be between 30 and 300 kg.')
      }
      if (weightKg !== current.weightKg) {
        patch.weightKg = weightKg
        changed.push(
          `Weight: ${current.weightKg ?? 'not set'} kg → ${weightKg} kg`,
        )
      }
    }

    const genderRaw = asString(raw.gender).toLowerCase()
    if (genderRaw) {
      if (genderRaw !== 'male' && genderRaw !== 'female' && genderRaw !== 'prefer_not') {
        return fail('Sex should be male, female, or prefer_not.')
      }
      const gender = genderRaw as OnboardingGender
      if (gender !== current.gender) {
        patch.gender = gender
        changed.push(`Sex: ${current.gender ?? 'not set'} → ${gender}`)
      }
    }

    const ageRaw = asString(raw.age_range || raw.ageRange).toLowerCase() as AgeRange
    if (ageRaw) {
      if (!AGES.has(ageRaw)) {
        return fail(
          'Age range options: under_18, 18_24, 25_34, 35_44, 45_54, 55_plus, prefer_not.',
        )
      }
      if (ageRaw !== current.ageRange) {
        patch.ageRange = ageRaw
        changed.push(`Age range: ${current.ageRange ?? 'not set'} → ${ageRaw}`)
      }
    }

    const goalRaw = asString(raw.primary_goal || raw.primaryGoal).toLowerCase() as FitnessGoal
    if (goalRaw) {
      if (!GOALS.has(goalRaw)) {
        return fail(
          'Goal options: build_muscle, lose_fat, get_stronger, endurance, stay_active, athletic, other.',
        )
      }
      if (goalRaw !== current.primaryGoal) {
        patch.primaryGoal = goalRaw
        changed.push(`Goal: ${current.primaryGoal ?? 'not set'} → ${goalRaw}`)
      }
    }

    const levelRaw = asString(
      raw.fitness_level || raw.fitnessLevel,
    ).toLowerCase() as FitnessLevel
    if (levelRaw) {
      if (!LEVELS.has(levelRaw)) {
        return fail('Level options: beginner, intermediate, advanced.')
      }
      if (levelRaw !== current.fitnessLevel) {
        patch.fitnessLevel = levelRaw
        changed.push(`Level: ${current.fitnessLevel ?? 'not set'} → ${levelRaw}`)
      }
    }

    const days = asNumber(raw.days_per_week ?? raw.daysPerWeek)
    if (Number.isFinite(days)) {
      const daysPerWeek = Math.round(days)
      if (daysPerWeek < 1 || daysPerWeek > 7) {
        return fail('Days per week must be between 1 and 7.')
      }
      if (daysPerWeek !== current.daysPerWeek) {
        patch.daysPerWeek = daysPerWeek
        changed.push(
          `Days/week: ${current.daysPerWeek ?? 'not set'} → ${daysPerWeek}`,
        )
      }
    }

    const durationRaw = asString(
      raw.workout_duration || raw.workoutDuration,
    ).toLowerCase() as WorkoutDuration
    if (durationRaw) {
      if (!DURATIONS.has(durationRaw)) {
        return fail('Duration options: under_30, 30_45, 45_60, over_60.')
      }
      if (durationRaw !== current.workoutDuration) {
        patch.workoutDuration = durationRaw
        changed.push(
          `Session length: ${current.workoutDuration ?? 'not set'} → ${durationRaw}`,
        )
      }
    }

    const locationRaw = asString(
      raw.training_location || raw.trainingLocation,
    ).toLowerCase() as TrainingLocation
    if (locationRaw) {
      if (!LOCATIONS.has(locationRaw)) {
        return fail('Location options: home, gym, both.')
      }
      if (locationRaw !== current.trainingLocation) {
        patch.trainingLocation = locationRaw
        changed.push(
          `Location: ${current.trainingLocation ?? 'not set'} → ${locationRaw}`,
        )
      }
    }

    if (raw.equipment !== undefined) {
      const equipment = parseEquipment(raw.equipment)
      if (!equipment) return fail('Equipment must be a list of equipment ids.')
      const prev = [...current.equipment].sort().join(',')
      const next = [...equipment].sort().join(',')
      if (prev !== next) {
        patch.equipment = equipment
        changed.push(
          `Equipment: ${current.equipment.length ? current.equipment.join(', ') : 'not set'} → ${
            equipment.length ? equipment.join(', ') : 'none'
          }`,
        )
      }
    }

    if (typeof raw.avoidances === 'string') {
      const avoidances = asString(raw.avoidances)
      if (avoidances !== current.avoidances) {
        patch.avoidances = avoidances
        changed.push('Updated exercises/equipment to avoid')
      }
    }

    if (typeof raw.limitations === 'string') {
      const limitations = asString(raw.limitations)
      if (limitations !== current.limitations) {
        patch.limitations = limitations
        changed.push('Updated injuries / limitations')
      }
    }

    if (changed.length === 0) {
      return fail(
        'Nothing new to save — ask which fields they want to set, or send them to /dashboard/fitness-profile.',
      )
    }

    return {
      ok: true,
      args: { patch, changed },
      before: current as unknown as JsonValue,
      preview: {
        title: 'Update your fitness profile',
        changes: [
          ...changed,
          'Saved on your fitness profile for coaching and program recommendations',
        ],
        undoable: true,
        confirmLabel: 'Save profile',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await saveOnboardingProgressAction(prepared.args.patch)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Updated fitness profile (${prepared.args.changed.join('; ')})`,
      after: prepared.args.patch as unknown as JsonValue,
      href: FITNESS_PROFILE_HREF,
    }
  },
  async undo(_ctx, input) {
    const before = input.before as OnboardingData | null
    if (!before) return fail('Could not restore the previous fitness profile.')
    const result = await saveOnboardingProgressAction({
      heightCm: before.heightCm,
      weightKg: before.weightKg,
      gender: before.gender,
      ageRange: before.ageRange,
      primaryGoal: before.primaryGoal,
      fitnessLevel: before.fitnessLevel,
      daysPerWeek: before.daysPerWeek,
      workoutDuration: before.workoutDuration,
      trainingLocation: before.trainingLocation,
      equipment: before.equipment,
      avoidances: before.avoidances,
      limitations: before.limitations,
    })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: 'Restored your previous fitness profile',
      after: before as unknown as JsonValue,
    }
  },
})

export const FITNESS_PROFILE_AGENT_ACTIONS: AnyAgentAction[] = [updateFitnessProfile]
