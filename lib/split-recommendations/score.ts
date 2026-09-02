import type { FitnessLevel } from '@/lib/onboarding-types'
import type { RecommendationInput, SplitTemplateDef } from './types'
import { SPLIT_TEMPLATES, THREE_DAY_TEMPLATE_IDS } from './templates'

const LEVEL_RANK: Record<FitnessLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
}

function levelMeets(min: FitnessLevel, user: FitnessLevel): boolean {
  return LEVEL_RANK[user] >= LEVEL_RANK[min]
}

export function eligibleTemplates(input: RecommendationInput): SplitTemplateDef[] {
  const { daysPerWeek, trainingLocation, seniorMode } = input
  const isGym =
    trainingLocation === 'gym' ||
    trainingLocation === 'both'

  return SPLIT_TEMPLATES.filter((t) => {
    if (seniorMode && t.blockedSenior) return false
    if (t.requiresGym && !isGym) return false
    if (!levelMeets(t.minLevel, input.fitnessLevel)) return false

    if (daysPerWeek === 3) {
      return THREE_DAY_TEMPLATE_IDS.has(t.id)
    }

    if (daysPerWeek < t.minDays || daysPerWeek > t.maxDays) {
      // Allow templates within ±1 day if close (e.g. user wants 5, template is 4-5)
      if (daysPerWeek + 1 < t.minDays || daysPerWeek - 1 > t.maxDays) {
        return false
      }
    }

    return true
  })
}

export function scoreTemplate(
  template: SplitTemplateDef,
  input: RecommendationInput,
): { score: number; reasons: string[] } {
  let score = 50
  const reasons: string[] = []

  const dayDelta = Math.abs(template.daysPerWeek - input.daysPerWeek)
  score -= dayDelta * 8
  if (dayDelta === 0) {
    reasons.push(`Matches your ${input.daysPerWeek}-day schedule`)
  }

  if (input.primaryGoal === 'get_stronger' && template.id === 'strength_fb') {
    score += 20
    reasons.push('Aligned with strength goal')
  }
  if (input.primaryGoal === 'build_muscle') {
    if (['ppl_6', 'ppl_5', 'bro_5', 'upper_lower'].includes(template.id)) {
      score += 15
      reasons.push('High frequency for muscle growth')
    }
    if (input.trainingStyles.includes('ppl') && template.id === 'bro_5') {
      score += 12
      reasons.push('Matches your preferred split style')
    }
  }
  if (
    (input.primaryGoal === 'lose_fat' || input.primaryGoal === 'endurance') &&
    template.id === 'hybrid_metcon'
  ) {
    score += 22
    reasons.push('Includes finisher circuits for conditioning')
  }
  if (input.primaryGoal === 'stay_active' && template.id === 'home_minimal') {
    score += 10
    reasons.push('Low barrier home training')
  }

  if (
    input.trainingLocation === 'home' &&
    (template.id === 'home_minimal' || !template.requiresGym)
  ) {
    score += 8
    reasons.push('Works with home equipment')
  }

  if (input.fitnessLevel === 'beginner' && ['full_body', 'upper_lower_3', 'home_minimal'].includes(template.id)) {
    score += 10
    reasons.push('Beginner-friendly structure')
  }

  if (input.seniorMode && ['full_body', 'full_body_4', 'upper_lower'].includes(template.id)) {
    score += 10
    reasons.push('Moderate frequency for recovery')
  }

  if (input.seniorMode && (template.id === 'ppl_6' || template.id === 'bro_5')) {
    score -= 100
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

export function buildRationale(
  template: SplitTemplateDef,
  reasons: string[],
  input: RecommendationInput,
): string {
  const unique = [...new Set(reasons)]
  const base = template.description
  if (input.seniorMode) {
    unique.push('Adjusted for joint-friendly exercise selection')
  }
  if (unique.length === 0) return base
  return `${base} ${unique.slice(0, 2).join('. ')}.`
}
