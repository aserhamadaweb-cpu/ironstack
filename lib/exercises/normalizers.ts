import type { SourceExercise } from '@/lib/exercises/types'
import {
  localGifUrlFromSource,
  localImageUrlFromSource,
} from '@/lib/exercises/paths'

const SOURCE_REQUIRED_KEYS = [
  'id',
  'name',
  'category',
  'body_part',
  'equipment',
  'instructions',
  'instruction_steps',
  'muscle_group',
  'secondary_muscles',
  'target',
  'media_id',
  'image',
  'gif_url',
  'attribution',
  'created_at',
] as const

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugFromValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Display labels for dataset target / muscle_group strings. */
const MUSCLE_LABELS: Record<string, string> = {
  abs: 'Abs',
  abdominals: 'Abs',
  core: 'Abs',
  obliques: 'Abs',
  'lower abs': 'Abs',
  pectorals: 'Chest',
  chest: 'Chest',
  'upper chest': 'Chest',
  lats: 'Back',
  'latissimus dorsi': 'Back',
  'upper back': 'Back',
  'lower back': 'Back',
  back: 'Back',
  spine: 'Back',
  rhomboids: 'Back',
  delts: 'Shoulders',
  deltoids: 'Shoulders',
  'rear deltoids': 'Shoulders',
  shoulders: 'Shoulders',
  traps: 'Traps',
  trapezius: 'Traps',
  biceps: 'Biceps',
  brachialis: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  soleus: 'Calves',
  forearms: 'Forearms',
  'wrist flexors': 'Forearms',
  'wrist extensors': 'Forearms',
  wrists: 'Forearms',
  hands: 'Forearms',
  'grip muscles': 'Forearms',
  abductors: 'Abductors',
  adductors: 'Adductors',
  'inner thighs': 'Adductors',
  groin: 'Adductors',
  neck: 'Neck',
  'levator scapulae': 'Neck',
  sternocleidomastoid: 'Neck',
  'cardiovascular system': 'Cardio',
  cardio: 'Cardio',
}

export function muscleDisplayLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Other'
  const key = raw.trim().toLowerCase()
  return MUSCLE_LABELS[key] ?? titleCase(raw.trim())
}

export function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') out[key] = entry
  }
  return out
}

export function asStringArrayRecord(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string[]> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(entry)) {
      out[key] = entry.filter((step): step is string => typeof step === 'string')
    }
  }
  return out
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

/**
 * Accept a source JSON object without dropping unknown keys.
 * Known fields are type-narrowed; everything else stays on the object.
 */
export function parseSourceExercise(raw: unknown): SourceExercise | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  const name = typeof row.name === 'string' ? row.name : ''
  if (!id || !name) return null

  const parsed: SourceExercise = {
    ...row,
    id,
    name,
    category: typeof row.category === 'string' ? row.category : '',
    body_part: typeof row.body_part === 'string' ? row.body_part : '',
    equipment: typeof row.equipment === 'string' ? row.equipment : '',
    instructions: asStringRecord(row.instructions),
    instruction_steps: asStringArrayRecord(row.instruction_steps),
    muscle_group: typeof row.muscle_group === 'string' ? row.muscle_group : '',
    secondary_muscles: asStringArray(row.secondary_muscles),
    target: typeof row.target === 'string' ? row.target : '',
    media_id: typeof row.media_id === 'string' ? row.media_id : '',
    image: typeof row.image === 'string' ? row.image : '',
    gif_url: typeof row.gif_url === 'string' ? row.gif_url : '',
    attribution: typeof row.attribution === 'string' ? row.attribution : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  }

  for (const key of SOURCE_REQUIRED_KEYS) {
    if (!(key in parsed)) return null
  }

  return parsed
}

export function sourceToExercise(
  source: SourceExercise,
  legacySlug: string | null = null,
) {
  return {
    sourceId: source.id,
    name: source.name,
    category: source.category,
    bodyPart: source.body_part,
    target: source.target,
    muscleGroup: source.muscle_group,
    secondaryMuscles: [...source.secondary_muscles],
    equipment: source.equipment,
    instructions: { ...source.instructions },
    instructionSteps: Object.fromEntries(
      Object.entries(source.instruction_steps).map(([locale, steps]) => [
        locale,
        [...steps],
      ]),
    ),
    image: localImageUrlFromSource(source.image),
    gifUrl: localGifUrlFromSource(source.gif_url),
    mediaId: source.media_id,
    attribution: source.attribution,
    createdAt: source.created_at,
    legacySlug,
    source,
  }
}
