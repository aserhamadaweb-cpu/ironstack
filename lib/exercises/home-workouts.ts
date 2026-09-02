import type { ExerciseCatalogItem } from '@/lib/exercise-catalog'
import type { LibraryExercise } from '@/lib/exercise-library'

/**
 * Home-workout suitability is derived from the existing 1,324-exercise
 * catalog metadata (especially `equipment`). This module does not copy
 * or rewrite any exercise records.
 */

export type HomeKit =
  | 'none'
  | 'bodyweight'
  | 'bands'
  | 'dumbbells'
  | 'kettlebells'
  | 'other'

export type HomeRegion = 'full' | 'upper' | 'lower' | 'core'

export type HomePack =
  | 'noEquipmentFull'
  | 'quickCore'
  | 'atHomeLegs'
  | 'atHomeUpper'

export type HomeWorkoutQuery = {
  kit: HomeKit | null
  region: HomeRegion | null
  pack: HomePack | null
}

const GYM_EQUIPMENT = new Set([
  'cable',
  'leverage machine',
  'smith machine',
  'sled machine',
  'assisted',
  'barbell',
  'ez barbell',
  'olympic barbell',
  'trap bar',
  'upper body ergometer',
  'skierg machine',
  'stationary bike',
  'elliptical machine',
  'stepmill machine',
])

const KIT_EQUIPMENT: Record<HomeKit, readonly string[]> = {
  none: ['body weight'],
  bodyweight: ['body weight', 'weighted'],
  bands: ['band', 'resistance band'],
  dumbbells: ['dumbbell'],
  kettlebells: ['kettlebell'],
  other: [
    'medicine ball',
    'stability ball',
    'bosu ball',
    'roller',
    'wheel roller',
    'rope',
    'hammer',
    'tire',
    'weighted',
  ],
}

const HOME_EQUIPMENT = new Set<string>([
  ...KIT_EQUIPMENT.none,
  ...KIT_EQUIPMENT.bodyweight,
  ...KIT_EQUIPMENT.bands,
  ...KIT_EQUIPMENT.dumbbells,
  ...KIT_EQUIPMENT.kettlebells,
  ...KIT_EQUIPMENT.other,
])

const UPPER_BODY_PARTS = new Set([
  'chest',
  'shoulders',
  'upper arms',
  'lower arms',
  'back',
  'neck',
])
const LOWER_BODY_PARTS = new Set(['upper legs', 'lower legs'])
const CORE_BODY_PARTS = new Set(['waist'])
const FULL_BODY_PARTS = new Set(['cardio'])

const UPPER_MUSCLES = new Set([
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Traps',
  'Neck',
])
const LOWER_MUSCLES = new Set([
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abductors',
  'Adductors',
])

export const HOME_KITS: HomeKit[] = [
  'none',
  'bodyweight',
  'bands',
  'dumbbells',
  'kettlebells',
  'other',
]

export const HOME_REGIONS: HomeRegion[] = ['full', 'upper', 'lower', 'core']

export const HOME_PACKS: HomePack[] = [
  'noEquipmentFull',
  'quickCore',
  'atHomeLegs',
  'atHomeUpper',
]

export const HOME_PACK_QUERY: Record<
  HomePack,
  Pick<HomeWorkoutQuery, 'kit' | 'region'>
> = {
  noEquipmentFull: { kit: 'none', region: null },
  quickCore: { kit: 'none', region: 'core' },
  atHomeLegs: { kit: null, region: 'lower' },
  atHomeUpper: { kit: null, region: 'upper' },
}

export function normalizeEquipmentKey(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function isGymEquipment(value: string | null | undefined): boolean {
  return GYM_EQUIPMENT.has(normalizeEquipmentKey(value))
}

export function isNoEquipment(value: string | null | undefined): boolean {
  return normalizeEquipmentKey(value) === 'body weight'
}

export function isHomeEquipment(value: string | null | undefined): boolean {
  const key = normalizeEquipmentKey(value)
  if (!key) return false
  if (GYM_EQUIPMENT.has(key)) return false
  return HOME_EQUIPMENT.has(key)
}

export function isHomeExercise(item: {
  equipment?: string | null
  tags?: string[]
}): boolean {
  return isHomeEquipment(item.equipment ?? item.tags?.[0] ?? null)
}

function bodyPartKey(item: ExerciseCatalogItem): string {
  return normalizeEquipmentKey(item.bodyPart ?? item.category ?? '')
}

function libraryFromItem(item: ExerciseCatalogItem): LibraryExercise | null {
  const source = item.source
  if (!source || typeof source !== 'object') return null
  if (!('muscles' in source) || !('equipment' in source)) return null
  return source as LibraryExercise
}

function isFullBody(item: ExerciseCatalogItem): boolean {
  if (FULL_BODY_PARTS.has(bodyPartKey(item))) return true
  const muscles = libraryFromItem(item)?.muscles ?? []
  const upper = muscles.some((muscle) => UPPER_MUSCLES.has(muscle))
  const lower = muscles.some((muscle) => LOWER_MUSCLES.has(muscle))
  return upper && lower
}

export function matchesHomeRegion(
  item: ExerciseCatalogItem,
  region: HomeRegion,
): boolean {
  const part = bodyPartKey(item)
  if (region === 'full') return isFullBody(item)
  if (region === 'upper') return UPPER_BODY_PARTS.has(part)
  if (region === 'lower') return LOWER_BODY_PARTS.has(part)
  if (region === 'core') return CORE_BODY_PARTS.has(part)
  return true
}

export function matchesHomeKit(
  item: ExerciseCatalogItem,
  kit: HomeKit,
): boolean {
  const equipment = normalizeEquipmentKey(item.equipment ?? item.tags?.[0] ?? '')
  return KIT_EQUIPMENT[kit].includes(equipment)
}

export function filterHomeExercises(
  items: ExerciseCatalogItem[],
  query: HomeWorkoutQuery,
): ExerciseCatalogItem[] {
  const kit = query.pack ? HOME_PACK_QUERY[query.pack].kit : query.kit
  const region = query.pack ? HOME_PACK_QUERY[query.pack].region : query.region

  return items.filter((item) => {
    if (!isHomeExercise(item)) return false
    if (kit && !matchesHomeKit(item, kit)) return false
    if (region && !matchesHomeRegion(item, region)) return false
    return true
  })
}
