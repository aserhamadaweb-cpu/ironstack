/** Slimmed-down exercise entry sent to the client (no instructions etc.). */
export type LibraryExercise = {
  id: string
  name: string
  /** Display labels, e.g. "Chest", "Quads". */
  muscles: string[]
  equipment: string
  level: string
  /** Dataset category, e.g. "strength", "plyometrics". */
  category: string | null
  /** Full thumbnail URL, or null when the entry has no images. */
  image: string | null
}

/** Filter chips shown in the Exercise Library. */
export const MUSCLE_FILTERS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Forearms',
  'Traps',
] as const
