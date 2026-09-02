import { loadExerciseCatalog } from '@/lib/exercises/catalog'
import type { DayFocusId } from './day-slot-presets'
import {
  defaultDayFocusRotation,
  roleForExplicitExerciseName,
  slotsForFocus,
} from './day-slot-presets'
import {
  detectExplicitUserRequests,
  enforceSafetyOnSchedule,
  safePickForSlotRelaxed,
  safePickForSlotWithTier,
} from './enforce-safety'
import type { CustomSplitIntent } from './parse-custom-intent'
import { parseCustomSplitIntent } from './parse-custom-intent'
import { buildAllowedEquipment } from './exercise-picker'
import type {
  ExerciseSlotRole,
  RecommendationInput,
  RecommendedDay,
  SplitRecommendation,
} from './types'
import { buildVolumeProfile } from './volume'
import { applyPromptTrainingHints, promptMentionsGym } from './prompt-profile'

const DAY_META: Record<
  DayFocusId,
  { name: string; subtitle: string; muscleFocus: string[] }
> = {
  full_body: {
    name: 'Full Body',
    subtitle: 'Balanced compound patterns',
    muscleFocus: ['Quads', 'Chest', 'Back', 'Core'],
  },
  upper: {
    name: 'Upper',
    subtitle: 'Push and pull emphasis',
    muscleFocus: ['Chest', 'Back', 'Shoulders', 'Arms'],
  },
  lower: {
    name: 'Lower',
    subtitle: 'Squat and hinge focus',
    muscleFocus: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  },
  push: {
    name: 'Push',
    subtitle: 'Chest, shoulders, triceps',
    muscleFocus: ['Chest', 'Shoulders', 'Triceps'],
  },
  pull: {
    name: 'Pull',
    subtitle: 'Back and biceps',
    muscleFocus: ['Lats', 'Upper Back', 'Biceps'],
  },
  legs: {
    name: 'Legs',
    subtitle: 'Quads, hamstrings, glutes',
    muscleFocus: ['Quads', 'Hamstrings', 'Glutes'],
  },
  chest_back: {
    name: 'Chest & Back',
    subtitle: 'Horizontal push and pull',
    muscleFocus: ['Chest', 'Back', 'Lats'],
  },
}

function explicitNameForRole(
  prompt: string,
  role: ExerciseSlotRole,
): string | undefined {
  for (const req of detectExplicitUserRequests(prompt)) {
    if (req.role === role) return req.matched
  }
  const quoted = prompt.match(/"([^"]+)"/)?.[1]
  if (quoted) {
    const mapped = roleForExplicitExerciseName(quoted)
    if (mapped === role) return quoted
  }
  return undefined
}

function applySeniorAdjustments(
  intent: CustomSplitIntent,
  userPrompt: string,
  input: RecommendationInput,
): { intent: CustomSplitIntent; warnings: string[] } {
  const warnings: string[] = []
  let { daysPerWeek, dayFocuses, name } = intent
  const { assumptions } = intent
  const lower = userPrompt.toLowerCase()

  const requestedDays = parseDaysFromPrompt(userPrompt, input.statedDaysPerWeek)
  if (input.seniorMode && requestedDays > 5) {
    warnings.push(
      `You asked for ${requestedDays} training days — capped at 5 for your profile.`,
    )
    daysPerWeek = Math.min(daysPerWeek, 5)
  }

  daysPerWeek = Math.max(
    1,
    Math.min(daysPerWeek, input.daysPerWeek > 0 ? input.daysPerWeek : daysPerWeek),
  )

  if (
    input.seniorMode &&
    (/bro[\s-]?split/.test(lower) || /6[\s-]?day/.test(lower))
  ) {
    warnings.push(
      'High-volume bro splits are adjusted for senior mode — using a push/pull/legs rotation instead.',
    )
    dayFocuses = defaultDayFocusRotation(daysPerWeek)
    if (/bro/.test(lower)) {
      name = name.replace(/bro split/i, 'Push Pull Legs')
    }
  }

  if (dayFocuses.length !== daysPerWeek) {
    dayFocuses = defaultDayFocusRotation(daysPerWeek)
  } else {
    dayFocuses = dayFocuses.slice(0, daysPerWeek)
  }

  return {
    intent: { ...intent, name, daysPerWeek, dayFocuses, assumptions },
    warnings,
  }
}

function parseDaysFromPrompt(text: string, fallback: number): number {
  const lower = text.toLowerCase()
  const m = lower.match(/\b([3-7])\s*-?\s*day/)
  if (m) return parseInt(m[1]!, 10)
  if (/\bsix\b|\b6\b/.test(lower) && /day/.test(lower)) return 6
  return fallback
}

export function buildCustomSplitFromIntent(
  intent: CustomSplitIntent,
  input: RecommendationInput,
  userPrompt: string,
): { recommendation: SplitRecommendation; warnings: string[] } | { error: string } {
  const { input: profileInput, assumptions: promptAssumptions } =
    applyPromptTrainingHints(input, userPrompt)

  const { intent: adjusted, warnings: seniorWarnings } = applySeniorAdjustments(
    intent,
    userPrompt,
    profileInput,
  )

  const catalog = loadExerciseCatalog()
  if (catalog.length === 0) {
    return {
      error:
        'The exercise catalog is temporarily unavailable. Please try again in a moment.',
    }
  }

  const allowed = buildAllowedEquipment(profileInput)
  const usedIds = new Set<string>()
  const volume = buildVolumeProfile(
    profileInput.fitnessLevel,
    profileInput.workoutDuration,
    profileInput.primaryGoal,
    profileInput.seniorMode,
  )
  const buildWarnings = [...seniorWarnings, ...promptAssumptions, ...adjusted.assumptions]
  const gymFromPrompt = promptMentionsGym(userPrompt)

  const schedule: RecommendedDay[] = []

  for (let i = 0; i < adjusted.daysPerWeek; i += 1) {
    const focus = adjusted.dayFocuses[i] ?? 'full_body'
    const meta = DAY_META[focus]
    const slots = slotsForFocus(focus)
    const exercises: RecommendedDay['exercises'] = []
    const exerciseBudget = volume.maxExercises

    for (const slot of slots) {
      if (exercises.length >= exerciseBudget) break
      const requested = explicitNameForRole(userPrompt, slot.role)
      let picked = safePickForSlotWithTier(
        slot.role,
        slot.tier,
        profileInput,
        allowed,
        usedIds,
        catalog,
        requested
          ? { userPrompt, requestedExerciseName: requested }
          : { userPrompt },
      )
      if (!picked.exercise) {
        picked = safePickForSlotRelaxed(
          slot.role,
          slot.tier,
          profileInput,
          usedIds,
          catalog,
          gymFromPrompt ? { gymEquipment: true } : undefined,
        )
      }
      buildWarnings.push(...picked.warnings)
      if (picked.exercise) exercises.push(picked.exercise)
    }

    if (exercises.length === 0) {
      return {
        error: `Could not build day ${i + 1} with your equipment and limitations.`,
      }
    }

    schedule.push({
      name: `${meta.name}${adjusted.daysPerWeek > 1 ? ` ${String.fromCharCode(65 + (i % 26))}` : ''}`,
      subtitle: meta.subtitle,
      muscleFocus: meta.muscleFocus,
      exercises,
    })
  }

  const { schedule: safeSchedule, warnings: safetyWarnings } =
    enforceSafetyOnSchedule(schedule, profileInput, userPrompt)

  if (safeSchedule.every((d) => d.exercises.length === 0)) {
    return {
      error: 'No safe exercises could be scheduled with your profile constraints.',
    }
  }

  const allWarnings = [...new Set([...buildWarnings, ...safetyWarnings].filter(Boolean))]

  const recommendation: SplitRecommendation = {
    id: `custom_ai_${crypto.randomUUID()}`,
    templateId: 'custom_ai',
    name: adjusted.name,
    typeLabel: 'Custom',
    daysPerWeek: adjusted.daysPerWeek,
    rationale:
      adjusted.description ||
      'Built from your description with catalog exercises matched to your profile.',
    score: 0,
    schedule: safeSchedule,
    warnings: allWarnings,
  }

  return { recommendation, warnings: allWarnings }
}

export async function buildCustomSplitFromPrompt(
  prompt: string,
  input: RecommendationInput,
): Promise<
  | { recommendation: SplitRecommendation; warnings: string[] }
  | { error: string }
> {
  const trimmed = prompt.trim()
  if (trimmed.length < 8) {
    return { error: 'Describe your ideal program in a bit more detail.' }
  }
  if (trimmed.length > 1200) {
    return { error: 'Please shorten your description (1200 characters max).' }
  }

  const intent = await parseCustomSplitIntent(trimmed, input)
  return buildCustomSplitFromIntent(intent, input, trimmed)
}
