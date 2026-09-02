/** Instruction locales supplied by hasaneyldrm/exercises-dataset. No Arabic. */
export const SOURCE_INSTRUCTION_LOCALES = [
  'en',
  'es',
  'it',
  'tr',
  'ru',
  'zh',
  'hi',
  'pl',
  'ko',
  'fr',
] as const

export type SourceInstructionLocale = (typeof SOURCE_INSTRUCTION_LOCALES)[number]

/** ISO 639-1 → instruction text. Extra keys are preserved if present. */
export type LocalizedText = Record<string, string>

/** ISO 639-1 → ordered instruction steps. Extra keys are preserved if present. */
export type LocalizedSteps = Record<string, string[]>

/**
 * Complete source record from data/exercises-dataset/exercises.json.
 * extra fields are kept so a schema addition is not silently dropped.
 */
export type SourceExercise = {
  id: string
  name: string
  category: string
  body_part: string
  equipment: string
  instructions: LocalizedText
  instruction_steps: LocalizedSteps
  muscle_group: string
  secondary_muscles: string[]
  target: string
  media_id: string
  image: string
  gif_url: string
  attribution: string
  created_at: string
  [key: string]: unknown
}

/**
 * App-facing exercise. Normalized fields are conveniences; `source` is the
 * complete original record and must not be stripped.
 */
export type Exercise = {
  sourceId: string
  name: string
  category: string
  bodyPart: string
  target: string
  muscleGroup: string
  secondaryMuscles: string[]
  equipment: string
  instructions: LocalizedText
  instructionSteps: LocalizedSteps
  image: string
  gifUrl: string
  mediaId: string
  attribution: string
  createdAt: string
  /** Existing lift_types.slug when this row matched a previously seeded exercise. */
  legacySlug: string | null
  source: SourceExercise
}

/** List/picker DTO — no instructions, no GIF. */
export type ExerciseSlim = {
  id: string
  name: string
  category: string
  bodyPart: string
  target: string
  muscleGroup: string
  secondaryMuscles: string[]
  equipment: string
  image: string
  mediaId: string
  legacySlug: string | null
}

export type IdentityMatchType = 'name' | 'alias' | 'slug-name'

export type IdentityMatch = {
  oldCatalogId: string
  legacySlug: string
  matchType: IdentityMatchType
}

export type IdentityMapFile = {
  version: 1
  generatedAt: string
  sourceCount: number
  oldCatalogCount: number
  matchedCount: number
  newCount: number
  unmatchedOldCount: number
  bySourceId: Record<string, IdentityMatch>
  unmatchedOld: Array<{ id: string; name: string; slug: string }>
}
