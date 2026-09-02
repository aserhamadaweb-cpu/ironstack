import { createClient, getAuthIdentity } from '@/lib/supabase/server'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import { getProfile } from '@/lib/data/queries'
import { emptyOnboardingData, type OnboardingData } from '@/lib/onboarding-types'
import {
  generateSplitRecommendations,
  inputFromOnboarding,
  inputFromOnboardingWithDefaults,
  type RecommendationInput,
  type SplitRecommendation,
} from '@/lib/split-recommendations'

export type SplitRecommendationsBundle = {
  recommendations: SplitRecommendation[]
  input: RecommendationInput | null
  /** Stable hash of profile fields that affect scoring — used to detect stale UI. */
  fingerprint: string | null
  error: string | null
}

/** Fields that invalidate cached recommendation displays when changed. */
export function recommendationInputFingerprint(
  input: RecommendationInput,
): string {
  return JSON.stringify({
    primaryGoal: input.primaryGoal,
    secondaryGoals: [...input.secondaryGoals].sort(),
    fitnessLevel: input.fitnessLevel,
    daysPerWeek: input.daysPerWeek,
    statedDaysPerWeek: input.statedDaysPerWeek,
    workoutDuration: input.workoutDuration,
    trainingLocation: input.trainingLocation,
    equipment: [...input.equipment].sort(),
    trainingStyles: [...input.trainingStyles].sort(),
    favoriteMuscleGroups: [...input.favoriteMuscleGroups].sort(),
    avoidances: input.avoidances.trim(),
    limitations: input.limitations.trim(),
    ageRange: input.ageRange,
    seniorMode: input.seniorMode,
  })
}

export async function resolveSplitRecommendations(
  override?: Partial<OnboardingData>,
): Promise<SplitRecommendationsBundle> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      recommendations: [],
      input: null,
      fingerprint: null,
      error: 'Not signed in.',
    }
  }

  const profileResult = await getProfile(user.id)
  const base = onboardingDataFromUser(user, profileResult.data ?? undefined)
  const merged = { ...base, ...override }
  const input =
    inputFromOnboarding(merged) ?? inputFromOnboardingWithDefaults(merged)

  try {
    const recommendations = generateSplitRecommendations(input)
    return {
      recommendations,
      input,
      fingerprint: recommendationInputFingerprint(input),
      error: recommendations.length === 0 ? 'Could not build recommendations.' : null,
    }
  } catch (err) {
    console.error('[split-recommendations] resolve', err)
    return {
      recommendations: [],
      input,
      fingerprint: recommendationInputFingerprint(input),
      error: 'Could not build recommendations.',
    }
  }
}

export async function getPrimarySplitSummary(userId: string): Promise<{
  id: string | null
  name: string | null
}> {
  const profile = await getProfile(userId)
  const id = profile.data?.primary_split_id ?? null
  if (!id) return { id: null, name: null }

  const supabase = await createClient()
  const { data } = await supabase
    .from('splits')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  return { id, name: data?.name ?? null }
}

/** Convenience for server actions — same bundle as pages use. */
export async function resolveSplitRecommendationsForAction(
  override?: Partial<OnboardingData>,
): Promise<
  | { data: SplitRecommendation[]; fingerprint: string | null; error: null }
  | { data: null; fingerprint: string | null; error: string }
> {
  const { userId } = await getAuthIdentity()
  if (!userId) {
    return { data: null, fingerprint: null, error: 'Not signed in.' }
  }

  const bundle = await resolveSplitRecommendations(override)
  if (bundle.error && !bundle.input) {
    return {
      data: null,
      fingerprint: bundle.fingerprint,
      error: bundle.error,
    }
  }

  if (!bundle.recommendations.length) {
    return {
      data: null,
      fingerprint: bundle.fingerprint,
      error: bundle.error ?? 'Could not build recommendations.',
    }
  }

  return {
    data: bundle.recommendations,
    fingerprint: bundle.fingerprint,
    error: null,
  }
}
