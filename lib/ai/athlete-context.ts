import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/queries'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import {
  inputFromOnboardingWithDefaults,
  type RecommendationInput,
} from '@/lib/split-recommendations/types'
import type { OnboardingData } from '@/lib/onboarding-types'
import {
  completenessFromOnboarding,
  FITNESS_PROFILE_HREF,
  getMissingProfileFields,
  labelMissingField,
  type ProfileMissingField,
} from '@/lib/profile-completeness'

export type AthleteContext = {
  displayName: string | null
  username: string | null
  preferredUnit: 'kg' | 'lb'
  language: 'en' | 'ar' | null
  heightCm: number | null
  weightKg: number | null
  gender: string | null
  birthDate: string | null
  primarySplitName: string | null
  /** Defaults filled for programming — may invent values athlete never set. */
  fitness: RecommendationInput | null
  rawOnboarding: OnboardingData | null
  missingFields: ProfileMissingField[]
}

/** Load body + fitness-profile identity for every coach turn. */
export async function loadAthleteContext(userId: string): Promise<AthleteContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return null

  const profileResult = await getProfile(userId)
  const profile = profileResult.data
  if (!profile) return null

  const onboarding = onboardingDataFromUser(user, profile)
  const fitness = inputFromOnboardingWithDefaults(onboarding)

  const weightKg =
    profile.current_weight_kg != null && Number.isFinite(Number(profile.current_weight_kg))
      ? Number(profile.current_weight_kg)
      : onboarding.weightKg

  const missingFields = getMissingProfileFields(
    completenessFromOnboarding(onboarding, {
      weightKg,
      heightCm: profile.height_cm ?? onboarding.heightCm,
      gender: profile.gender ?? onboarding.gender,
      birthDate: profile.birth_date,
    }),
  )

  let primarySplitName: string | null = null
  if (profile.primary_split_id) {
    const { data: split } = await supabase
      .from('splits')
      .select('name')
      .eq('id', profile.primary_split_id)
      .maybeSingle()
    primarySplitName = split?.name ?? null
  }

  return {
    displayName: profile.display_name,
    username: profile.username,
    preferredUnit: profile.preferred_unit === 'lb' ? 'lb' : 'kg',
    language: profile.language === 'ar' || profile.language === 'en' ? profile.language : null,
    heightCm: profile.height_cm ?? onboarding.heightCm,
    weightKg,
    gender: profile.gender ?? onboarding.gender,
    birthDate: profile.birth_date,
    primarySplitName,
    fitness,
    rawOnboarding: onboarding,
    missingFields,
  }
}

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'lb') {
    return `${Math.round(kg * 2.2046226218)} lb (${kg.toFixed(1)} kg)`
  }
  return `${kg.toFixed(1)} kg`
}

/** Compact block injected into the coach system prompt every turn. */
export function formatAthleteContextForPrompt(ctx: AthleteContext): string {
  const lines = [
    'ATHLETE PROFILE (authoritative for this athlete — honor it unless a tool returns newer data):',
  ]

  const identity: string[] = []
  if (ctx.displayName) identity.push(ctx.displayName)
  if (ctx.username) identity.push(`@${ctx.username}`)
  if (identity.length) lines.push(`- Name: ${identity.join(' ')}`)

  lines.push(`- Units: ${ctx.preferredUnit}`)
  if (ctx.language) lines.push(`- App language: ${ctx.language}`)

  const body: string[] = []
  if (ctx.weightKg != null) body.push(`weight ${formatWeight(ctx.weightKg, ctx.preferredUnit)}`)
  if (ctx.heightCm != null) body.push(`height ${ctx.heightCm} cm`)
  if (ctx.gender) body.push(`sex ${ctx.gender}`)
  if (ctx.birthDate) body.push(`birth date ${ctx.birthDate}`)
  if (body.length) lines.push(`- Body: ${body.join(', ')}`)

  const onboarding = ctx.rawOnboarding
  if (onboarding) {
    if (onboarding.primaryGoal) lines.push(`- Primary goal: ${onboarding.primaryGoal}`)
    if (onboarding.secondaryGoals.length > 0) {
      lines.push(`- Secondary goals: ${onboarding.secondaryGoals.join(', ')}`)
    }
    if (onboarding.fitnessLevel) lines.push(`- Fitness level: ${onboarding.fitnessLevel}`)
    if (onboarding.daysPerWeek != null && onboarding.workoutDuration) {
      lines.push(
        `- Schedule: ${onboarding.daysPerWeek} days/week, ${onboarding.workoutDuration.replace(/_/g, ' ')} sessions`,
      )
    } else if (onboarding.daysPerWeek != null) {
      lines.push(`- Days per week: ${onboarding.daysPerWeek}`)
    } else if (onboarding.workoutDuration) {
      lines.push(`- Session length: ${onboarding.workoutDuration.replace(/_/g, ' ')}`)
    }
    if (onboarding.preferredDays?.length) {
      lines.push(`- Preferred weekdays: ${onboarding.preferredDays.join(', ')}`)
    }
    if (onboarding.trainingLocation) {
      lines.push(`- Training location: ${onboarding.trainingLocation}`)
    }
    if (onboarding.equipment.length > 0) {
      lines.push(`- Equipment: ${onboarding.equipment.join(', ')}`)
    }
    if (onboarding.trainingStyles.length > 0) {
      lines.push(`- Preferred styles: ${onboarding.trainingStyles.join(', ')}`)
    }
    if (onboarding.favoriteMuscleGroups.length > 0) {
      lines.push(`- Favorite muscles: ${onboarding.favoriteMuscleGroups.join(', ')}`)
    }
    if (onboarding.ageRange) lines.push(`- Age range: ${onboarding.ageRange}`)
    if (onboarding.avoidances.trim()) lines.push(`- Avoid: ${onboarding.avoidances.trim()}`)
    if (onboarding.limitations.trim()) {
      lines.push(`- Limitations: ${onboarding.limitations.trim()}`)
    }
  }

  if (ctx.primarySplitName) {
    lines.push(`- Primary program: ${ctx.primarySplitName}`)
  }

  if (ctx.missingFields.length > 0) {
    lines.push(
      `- MISSING (athlete never set these — do NOT invent values): ${ctx.missingFields
        .map(labelMissingField)
        .join(', ')}`,
    )
    lines.push(
      `- Incomplete-profile rules: When you need a missing field, call propose_profile_interview so the athlete taps choices (same UX as Create Split with AI) — never ask those as free-text chat questions. They can also open ${FITNESS_PROFILE_HREF}. Never pretend defaults are their real answers.`,
    )
  } else {
    lines.push(
      '- Use this profile for coaching, loading, programming, and nutrition-adjacent advice. Call tools for live PRs, streaks, and session history.',
    )
  }

  return lines.join('\n')
}
