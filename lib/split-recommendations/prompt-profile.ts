import type { RecommendationInput } from './types'

const GYM_PROMPT =
  /\b(at the gym|in the gym|commercial gym|fitness center|health club|gymnasium|\bgym\b)/i

/** When the user explicitly asks for a gym program, honor that over a home-only profile. */
export function applyPromptTrainingHints(
  input: RecommendationInput,
  userPrompt: string,
): { input: RecommendationInput; assumptions: string[] } {
  const assumptions: string[] = []
  let next = input

  if (GYM_PROMPT.test(userPrompt)) {
    if (input.trainingLocation !== 'gym' && input.trainingLocation !== 'both') {
      next = { ...next, trainingLocation: 'gym' }
      assumptions.push(
        'You asked for a gym program — using full gym equipment for exercise selection.',
      )
    }
  }

  return { input: next, assumptions }
}

export function promptMentionsGym(userPrompt: string): boolean {
  return GYM_PROMPT.test(userPrompt)
}
