import type { ExerciseSlotRole, TemplateDaySlot } from './types'

/** Slot layouts reused from template definitions — shared by custom AI builder. */
export const FB_MAIN: TemplateDaySlot[] = [
  { role: 'squat', tier: 'main' },
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'hinge', tier: 'accessory' },
  { role: 'vertical_push', tier: 'accessory' },
  { role: 'core', tier: 'accessory' },
]

export const UL_UPPER: TemplateDaySlot[] = [
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'vertical_push', tier: 'main' },
  { role: 'vertical_pull', tier: 'main' },
  { role: 'bicep_accessory', tier: 'accessory' },
  { role: 'tricep_accessory', tier: 'accessory' },
]

export const UL_LOWER: TemplateDaySlot[] = [
  { role: 'squat', tier: 'main' },
  { role: 'hinge', tier: 'main' },
  { role: 'quad_accessory', tier: 'accessory' },
  { role: 'ham_accessory', tier: 'accessory' },
  { role: 'glute_accessory', tier: 'accessory' },
  { role: 'calf', tier: 'accessory' },
]

export const PUSH: TemplateDaySlot[] = [
  { role: 'horizontal_push', tier: 'main' },
  { role: 'vertical_push', tier: 'main' },
  { role: 'chest_accessory', tier: 'accessory' },
  { role: 'shoulder_accessory', tier: 'accessory' },
  { role: 'tricep_accessory', tier: 'accessory' },
]

export const PULL: TemplateDaySlot[] = [
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'vertical_pull', tier: 'main' },
  { role: 'horizontal_pull', tier: 'accessory' },
  { role: 'bicep_accessory', tier: 'accessory' },
  { role: 'core', tier: 'accessory' },
]

export const LEGS: TemplateDaySlot[] = [
  { role: 'squat', tier: 'main' },
  { role: 'hinge', tier: 'main' },
  { role: 'quad_accessory', tier: 'accessory' },
  { role: 'ham_accessory', tier: 'accessory' },
  { role: 'calf', tier: 'accessory' },
]

export const CHEST_BACK: TemplateDaySlot[] = [
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'vertical_pull', tier: 'main' },
  { role: 'chest_accessory', tier: 'accessory' },
  { role: 'horizontal_pull', tier: 'accessory' },
  { role: 'core', tier: 'accessory' },
]

export type DayFocusId =
  | 'full_body'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'chest_back'

export const DAY_FOCUS_SLOTS: Record<DayFocusId, TemplateDaySlot[]> = {
  full_body: FB_MAIN,
  upper: UL_UPPER,
  lower: UL_LOWER,
  push: PUSH,
  pull: PULL,
  legs: LEGS,
  chest_back: CHEST_BACK,
}

/** Rotate focuses for N training days. */
export function defaultDayFocusRotation(daysPerWeek: number): DayFocusId[] {
  const pool: DayFocusId[] =
    daysPerWeek <= 3
      ? ['full_body', 'full_body', 'full_body']
      : daysPerWeek === 4
        ? ['upper', 'lower', 'upper', 'lower']
        : daysPerWeek === 5
          ? ['push', 'pull', 'legs', 'upper', 'lower']
          : ['push', 'pull', 'legs', 'push', 'pull', 'legs']

  return pool.slice(0, daysPerWeek)
}

export function slotsForFocus(focus: DayFocusId): TemplateDaySlot[] {
  return DAY_FOCUS_SLOTS[focus] ?? FB_MAIN
}

export function roleForExplicitExerciseName(name: string): ExerciseSlotRole | null {
  const n = name.toLowerCase()
  if (/curl|bicep/.test(n)) return 'bicep_accessory'
  if (/tricep|pushdown|skull/.test(n)) return 'tricep_accessory'
  if (/row|pull-up|chin|pulldown|lat /.test(n)) return 'vertical_pull'
  if (/bench|press|push-up|fly|crossover/.test(n)) return 'horizontal_push'
  if (/squat|leg press|lunge|step-up/.test(n)) return 'squat'
  if (/deadlift|rdl|hip thrust|glute bridge|hinge/.test(n)) return 'hinge'
  if (/leg curl|hamstring/.test(n)) return 'ham_accessory'
  if (/leg extension|quad/.test(n)) return 'quad_accessory'
  if (/calf|raise/.test(n)) return 'calf'
  if (/plank|crunch|core|ab /.test(n)) return 'core'
  if (/overhead|shoulder press|military|ohp|lateral raise/.test(n)) {
    return 'vertical_push'
  }
  return null
}
