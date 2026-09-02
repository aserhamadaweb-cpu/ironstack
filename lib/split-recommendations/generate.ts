import type { OnboardingData } from '@/lib/onboarding-types'
import { loadExerciseCatalog } from '@/lib/exercises/catalog'
import {
  buildAllowedEquipment,
  exerciseToRecommended,
  pickExerciseForSlot,
} from './exercise-picker'
import {
  buildRationale,
  eligibleTemplates,
  scoreTemplate,
} from './score'
import { getTemplateById } from './templates'
import type {
  RecommendationInput,
  RecommendedDay,
  SplitRecommendation,
  SplitTemplateDef,
} from './types'
import { inputFromOnboarding } from './types'
import { buildVolumeProfile } from './volume'

const FINISHER_NOTE =
  '8–12 min circuit: 3 rounds of 40s work / 20s rest (bike, row, or brisk walk between strength sets).'

function trimTemplateDays(
  template: SplitTemplateDef,
  daysPerWeek: number,
): SplitTemplateDef {
  if (template.days.length <= daysPerWeek) return template
  return {
    ...template,
    days: template.days.slice(0, daysPerWeek),
    daysPerWeek,
  }
}

function buildSchedule(
  template: SplitTemplateDef,
  input: RecommendationInput,
): RecommendedDay[] {
  const volume = buildVolumeProfile(
    input.fitnessLevel,
    input.workoutDuration,
    input.primaryGoal,
    input.seniorMode,
  )
  const allowed = buildAllowedEquipment(input)
  const usedIds = new Set<string>()
  const catalog = loadExerciseCatalog()
  const wantsFinisher =
    input.primaryGoal === 'lose_fat' ||
    input.primaryGoal === 'endurance' ||
    input.secondaryGoals.includes('lose_fat') ||
    input.secondaryGoals.includes('endurance')

  const finisherReserve = wantsFinisher ? 1 : 0

  const days: RecommendedDay[] = []

  for (const dayDef of template.days) {
    const exercises: RecommendedDay['exercises'] = []
    let finisherNote: string | undefined
    const exerciseBudget = Math.max(1, volume.maxExercises - finisherReserve)

    for (const slot of dayDef.slots) {
      if (exercises.length >= exerciseBudget) break
      if (slot.tier === 'finisher') {
        if (!wantsFinisher && template.id !== 'hybrid_metcon') continue
        finisherNote = FINISHER_NOTE
        const finisher = pickExerciseForSlot(
          'cardio_finisher',
          input,
          allowed,
          usedIds,
          catalog,
        )
        if (finisher) {
          exercises.push(
            exerciseToRecommended(finisher, 3, '40s', true),
          )
        }
        continue
      }

      const picked = pickExerciseForSlot(
        slot.role,
        input,
        allowed,
        usedIds,
        catalog,
      )
      if (!picked) continue

      const sets =
        slot.tier === 'main' ? volume.mainSets : volume.accessorySets
      const reps =
        slot.tier === 'main' ? volume.mainReps : volume.accessoryReps

      exercises.push(exerciseToRecommended(picked, sets, reps))
    }

    if (
      wantsFinisher &&
      !finisherNote
    ) {
      finisherNote = FINISHER_NOTE
      if (exercises.length < volume.maxExercises) {
        const finisher = pickExerciseForSlot(
          'cardio_finisher',
          input,
          allowed,
          usedIds,
          catalog,
        )
        if (finisher) {
          exercises.push(exerciseToRecommended(finisher, 3, '40s', true))
        }
      }
    }

    days.push({
      name: dayDef.name,
      subtitle: dayDef.subtitle,
      muscleFocus: dayDef.muscleFocus,
      exercises,
      finisherNote,
    })
  }

  return days
}

function materializeRecommendation(
  template: SplitTemplateDef,
  input: RecommendationInput,
): SplitRecommendation | null {
  const trimmed = trimTemplateDays(template, input.daysPerWeek)
  const schedule = buildSchedule(trimmed, input)
  if (schedule.every((d) => d.exercises.length === 0)) return null

  const { score, reasons } = scoreTemplate(trimmed, input)
  return {
    id: `${trimmed.id}_${input.daysPerWeek}d`,
    templateId: trimmed.id,
    name: trimmed.name,
    typeLabel: trimmed.typeLabel,
    daysPerWeek: trimmed.daysPerWeek,
    rationale: buildRationale(trimmed, reasons, input),
    score,
    schedule,
  }
}

export function generateSplitRecommendations(
  input: RecommendationInput,
): SplitRecommendation[] {
  const pool = eligibleTemplates(input)
  const scored = pool
    .map((template) => ({
      template,
      ...scoreTemplate(template, input),
    }))
    .sort((a, b) => b.score - a.score)

  const out: SplitRecommendation[] = []
  const seenTemplates = new Set<string>()

  for (const row of scored) {
    if (seenTemplates.has(row.template.id)) continue
    const rec = materializeRecommendation(row.template, input)
    if (!rec) continue
    seenTemplates.add(row.template.id)
    out.push(rec)
    if (out.length >= 4) break
  }

  // Ensure at least one sensible fallback for sparse equipment.
  if (out.length < 3) {
    for (const fallbackId of ['full_body', 'home_minimal', 'upper_lower']) {
      if (out.length >= 3) break
      if (seenTemplates.has(fallbackId)) continue
      const template = getTemplateById(fallbackId)
      if (!template) continue
      const rec = materializeRecommendation(
        trimTemplateDays(template, Math.min(input.daysPerWeek, template.daysPerWeek)),
        input,
      )
      if (rec) {
        seenTemplates.add(fallbackId)
        out.push(rec)
      }
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 4)
}

export function generateFromOnboardingData(
  data: OnboardingData,
): SplitRecommendation[] {
  const input = inputFromOnboarding(data)
  if (!input) return []
  return generateSplitRecommendations(input)
}

export { inputFromOnboarding }
