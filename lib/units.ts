/** Weight/volume/height display helpers. Stored body metrics use metric (kg, cm). */

export type WeightUnit = 'kg' | 'lb'

const LB_PER_KG = 2.2046226218
const CM_PER_INCH = 2.54

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === 'lb') return kg * LB_PER_KG
  return kg
}

export function displayToKg(value: number, unit: WeightUnit): number {
  if (unit === 'lb') return value / LB_PER_KG
  return value
}

/** Format a kg-stored weight for the athlete's preferred unit. */
export function formatWeightKg(
  kg: number | null | undefined,
  unit: WeightUnit = 'kg',
  digits = 0,
): string {
  if (kg == null || Number.isNaN(Number(kg))) return `— ${unit}`
  const n = kgToDisplay(Number(kg), unit)
  const rounded =
    digits === 0 ? Math.round(n) : Math.round(n * 10 ** digits) / 10 ** digits
  return `${rounded} ${unit}`
}

/** Format kg-stored volume (e.g. session totals). */
export function formatVolumeKg(
  kg: number | null | undefined,
  unit: WeightUnit = 'kg',
): string {
  if (kg == null || Number.isNaN(Number(kg))) return `0 ${unit}`
  const n = kgToDisplay(Number(kg), unit)
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k ${unit}`
  }
  return `${Math.round(n)} ${unit}`
}

export function isCardioCategory(category: string | null | undefined): boolean {
  return category?.trim().toLowerCase() === 'cardio'
}

/** Stored on lift_logs.notes so a bodyweight set can satisfy weight > 0 without showing a load. */
export const BODYWEIGHT_LOG_NOTE = 'bodyweight'

export function isBodyweightLogNote(notes: string | null | undefined): boolean {
  return notes?.trim().toLowerCase() === BODYWEIGHT_LOG_NOTE
}

/** Format lift_log duration_seconds for display (e.g. "32 min"). */
export function formatDurationSeconds(
  seconds: number | null | undefined,
): string {
  if (seconds == null || !(seconds > 0)) return '—'
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes} min` : `${hours}h`
}

export function formatLiftSetDisplay(input: {
  weightKg?: number | null
  reps?: number | null
  durationSeconds?: number | null
  weightUnit?: WeightUnit
  isCardio?: boolean
  repsOnly?: boolean
}): string {
  if (
    input.isCardio ||
    (input.durationSeconds != null && input.durationSeconds > 0)
  ) {
    return formatDurationSeconds(input.durationSeconds)
  }
  if (input.repsOnly) return `${input.reps ?? 0} reps`
  return `${formatWeightKg(input.weightKg, input.weightUnit ?? 'kg')} × ${input.reps ?? 0}`
}

export function formatLiftLabel(
  name: string | null | undefined,
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  unit: WeightUnit = 'kg',
  durationSeconds?: number | null,
  repsOnly?: boolean,
): string | null {
  if (!name) return null
  if (durationSeconds != null && durationSeconds > 0) {
    return `${name} — ${formatDurationSeconds(durationSeconds)}`
  }
  if (repsOnly) return `${name} — ${reps ?? 0} reps`
  if (weightKg == null) return null
  return `${name} — ${formatWeightKg(weightKg, unit)} × ${reps ?? 0}`
}

/** Height is stored as cm. When weight unit is lb, display as ft/in. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Number(cm) / CM_PER_INCH
  let feet = Math.floor(totalInches / 12)
  let inches = Math.round(totalInches - feet * 12)
  if (inches === 12) {
    feet += 1
    inches = 0
  }
  return { feet, inches }
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH
}

export function formatHeightCm(
  cm: number | null | undefined,
  weightUnit: WeightUnit = 'kg',
): string {
  if (cm == null || Number.isNaN(Number(cm))) return '—'
  if (weightUnit === 'lb') {
    const { feet, inches } = cmToFeetInches(Number(cm))
    return `${feet}'${inches}"`
  }
  return `${Math.round(Number(cm))} cm`
}

/** Age in whole years from an ISO date (YYYY-MM-DD). */
export function ageFromBirthDate(
  birthDate: string | null | undefined,
  now = new Date(),
): number | null {
  if (!birthDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null

  let age = now.getFullYear() - year
  const monthDiff = now.getMonth() + 1 - month
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    age -= 1
  }
  if (age < 0 || age > 130) return null
  return age
}

export const BODY_HEIGHT_CM_MIN = 100
export const BODY_HEIGHT_CM_MAX = 250
export const BODY_WEIGHT_KG_MIN = 30
export const BODY_WEIGHT_KG_MAX = 300
export const BODY_AGE_MIN = 10
export const BODY_AGE_MAX = 100

export function isValidHeightCm(cm: number): boolean {
  return (
    Number.isFinite(cm) &&
    cm >= BODY_HEIGHT_CM_MIN &&
    cm <= BODY_HEIGHT_CM_MAX
  )
}

export function isValidWeightKg(kg: number): boolean {
  return (
    Number.isFinite(kg) &&
    kg >= BODY_WEIGHT_KG_MIN &&
    kg <= BODY_WEIGHT_KG_MAX
  )
}

export function isValidBirthDate(isoDate: string, now = new Date()): boolean {
  const age = ageFromBirthDate(isoDate, now)
  return age != null && age >= BODY_AGE_MIN && age <= BODY_AGE_MAX
}
