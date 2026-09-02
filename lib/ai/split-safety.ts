import type { SplitProposal } from '@/lib/ai/action-types'
import { getProfile } from '@/lib/data/queries'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import { createClient } from '@/lib/supabase/server'
import {
  enforceSafetyOnSplitProposal,
  userPromptFromSplitProposal,
} from '@/lib/split-recommendations/enforce-safety'
import { inputFromOnboarding } from '@/lib/split-recommendations/types'
import type { RecommendationInput } from '@/lib/split-recommendations/types'

export async function recommendationInputForCoachUser(
  userId: string,
): Promise<RecommendationInput | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return null

  const profile = await getProfile(userId)
  return inputFromOnboarding(onboardingDataFromUser(user, profile.data ?? undefined))
}

export async function applyCoachSplitSafety(
  proposal: SplitProposal,
  userId: string,
  options?: { userPromptHint?: string },
): Promise<{
  proposal: SplitProposal
  warnings: string[]
  input: RecommendationInput | null
}> {
  const input = await recommendationInputForCoachUser(userId)
  if (!input) {
    return {
      proposal: {
        ...proposal,
        warnings: [
          'Complete your fitness profile to enable full exercise safety checks.',
        ],
      },
      warnings: [
        'Complete your fitness profile to enable full exercise safety checks.',
      ],
      input: null,
    }
  }

  const userPrompt = userPromptFromSplitProposal(proposal, options?.userPromptHint)
  const result = enforceSafetyOnSplitProposal(proposal, input, userPrompt)
  return { ...result, input }
}

export function coachSplitProposalIsSaveable(proposal: SplitProposal): boolean {
  return proposal.days.length > 0 && proposal.days.every((day) => day.exercises.length > 0)
}
