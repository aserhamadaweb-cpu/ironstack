import type { AppLocale } from '@/lib/i18n'
import type { LocalizedSteps, LocalizedText } from '@/lib/exercises/types'
import { SOURCE_INSTRUCTION_LOCALES } from '@/lib/exercises/types'
import { GYM_VISUAL_ATTRIBUTION } from '@/lib/exercises/paths'
import { titleCase } from '@/lib/exercises/normalizers'

export const INSTRUCTION_LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  tr: 'Türkçe',
  ru: 'Русский',
  zh: '中文',
  hi: 'हिन्दी',
  pl: 'Polski',
  ko: '한국어',
  fr: 'Français',
  ar: 'العربية',
}

/**
 * App is en/ar; dataset has no Arabic. Prefer the UI locale when the dataset
 * has it, otherwise English. Never invent translations.
 */
export function resolveInstructionLocale(
  available: LocalizedText | LocalizedSteps,
  appLocale: string | null | undefined,
): string {
  const locales = Object.keys(available).filter((key) => {
    const value = available[key]
    if (typeof value === 'string') return value.trim().length > 0
    return Array.isArray(value) && value.length > 0
  })
  if (locales.length === 0) return 'en'
  if (appLocale && locales.includes(appLocale)) return appLocale
  if (locales.includes('en')) return 'en'
  return locales[0]
}

export function instructionLocalesFor(exercise: {
  instructions: LocalizedText
  instructionSteps: LocalizedSteps
}): string[] {
  const fromText = Object.keys(exercise.instructions)
  const fromSteps = Object.keys(exercise.instructionSteps)
  const merged = [...new Set([...SOURCE_INSTRUCTION_LOCALES, ...fromText, ...fromSteps])]
  return merged.filter((locale) => {
    const text = exercise.instructions[locale]
    const steps = exercise.instructionSteps[locale]
    return Boolean(text?.trim()) || Boolean(steps?.length)
  })
}

export function stepsForLocale(
  exercise: { instructions: LocalizedText; instructionSteps: LocalizedSteps },
  locale: string,
): string[] {
  const steps = exercise.instructionSteps[locale]
  if (steps?.length) return steps
  const text = exercise.instructions[locale]
  if (text?.trim()) {
    return text
      .split(/(?<=\.)\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

export function attributionText(exercise: { attribution: string }): string {
  return exercise.attribution?.trim() || GYM_VISUAL_ATTRIBUTION
}

export function supportingMuscles(exercise: {
  muscleGroup: string
  secondaryMuscles: string[]
}): string[] {
  return [...new Set([exercise.muscleGroup, ...exercise.secondaryMuscles].filter(Boolean))]
}

export function formatBodyPart(value: string): string {
  return titleCase(value)
}

export function defaultInstructionLocale(appLocale: AppLocale): string {
  return appLocale === 'ar' ? 'en' : appLocale
}
