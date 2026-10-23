import type { OnboardingData } from '@/lib/onboarding-types'
import { buildCuratedRecommendations } from './curated-programs'
import type { RecommendationInput, SplitRecommendation } from './types'
import { inputFromOnboarding } from './types'

/**
 * Recommended splits are the curated gym programs (PPL, Arnold, FBEoD,
 * Pro Split, Anterior/Posterior). Profile input is kept for API compatibility
 * but no longer drives template scoring.
 */
export function generateSplitRecommendations(
  _input: RecommendationInput,
): SplitRecommendation[] {
  return buildCuratedRecommendations()
}

export function generateFromOnboardingData(
  data: OnboardingData,
): SplitRecommendation[] {
  const input = inputFromOnboarding(data)
  if (!input) return []
  return generateSplitRecommendations(input)
}

export { inputFromOnboarding }
