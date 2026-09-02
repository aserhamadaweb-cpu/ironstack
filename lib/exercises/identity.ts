import type { IdentityMapFile, IdentityMatch } from '@/lib/exercises/types'
import { normalizeKey, slugFromValue } from '@/lib/exercises/normalizers'

/**
 * Curated map from ready-made / seeded split exercise names to free-exercise-db
 * entry ids — used to keep existing lift_types UUIDs when the catalog source changes.
 */
export const SPLIT_LIBRARY_ALIASES: Record<string, string> = {
  'Barbell Bench Press': 'Barbell_Bench_Press_-_Medium_Grip',
  'Seated Dumbbell Shoulder Press': 'Dumbbell_Shoulder_Press',
  'Incline Dumbbell Press': 'Incline_Dumbbell_Press',
  'Cable Lateral Raise': 'Cable_Seated_Lateral_Raise',
  'Overhead Rope Triceps Extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'Triceps Pushdown': 'Triceps_Pushdown',
  Deadlift: 'Barbell_Deadlift',
  'Pull-Up': 'Pullups',
  'Chest-Supported Row': 'Lying_T-Bar_Row',
  'Face Pull': 'Face_Pull',
  'Barbell Curl': 'Barbell_Curl',
  'Incline Dumbbell Curl': 'Incline_Dumbbell_Curl',
  'Back Squat': 'Barbell_Squat',
  'Romanian Deadlift': 'Romanian_Deadlift',
  'Leg Press': 'Leg_Press',
  'Seated Leg Curl': 'Seated_Leg_Curl',
  'Standing Calf Raise': 'Standing_Calf_Raises',
  'Hanging Leg Raise': 'Hanging_Leg_Raise',
  'Barbell Row': 'Bent_Over_Barbell_Row',
  'Standing Overhead Press': 'Standing_Military_Press',
  'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
  'Dumbbell Lateral Raise': 'Side_Lateral_Raise',
  'Skull Crusher': 'EZ-Bar_Skullcrusher',
  'Hammer Curl': 'Hammer_Curls',
  'Bulgarian Split Squat': 'Split_Squats',
  'Leg Extension': 'Leg_Extensions',
  'Seated Calf Raise': 'Seated_Calf_Raise',
  Plank: 'Plank',
  'Arnold Press': 'Arnold_Dumbbell_Press',
  'Cable Fly': 'Flat_Bench_Cable_Flyes',
  'Straight-Arm Pulldown': 'Straight-Arm_Pulldown',
  'Cable Curl': 'Standing_Biceps_Cable_Curl',
  'Rope Pushdown': 'Triceps_Pushdown_-_Rope_Attachment',
  'Front Squat': 'Front_Barbell_Squat',
  'Barbell Hip Thrust': 'Barbell_Hip_Thrust',
  'Walking Lunge': 'Barbell_Walking_Lunge',
  'Lying Leg Curl': 'Lying_Leg_Curls',
  'Cable Crunch': 'Cable_Crunch',
  'Seated Cable Row': 'Seated_Cable_Rows',
  'Dumbbell Curl': 'Seated_Dumbbell_Curl',
  'Chest Dip': 'Dips_-_Chest_Version',
  'Push-Up (Burnout)': 'Pushups',
  'Rear-Delt Fly': 'Cable_Rear_Delt_Fly',
  'Cable Front Raise': 'Front_Cable_Raise',
  'Barbell Shrug': 'Barbell_Shrug',
  'Close-Grip Bench Press': 'Close-Grip_Barbell_Bench_Press',
  'Overhead Rope Extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'Cable Hammer Curl': 'Cable_Hammer_Curls_-_Rope_Attachment',
}

export type OldCatalogRow = {
  id: string
  name: string
}

export function emptyIdentityMap(): IdentityMapFile {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceCount: 0,
    oldCatalogCount: 0,
    matchedCount: 0,
    newCount: 0,
    unmatchedOldCount: 0,
    bySourceId: {},
    unmatchedOld: [],
  }
}

export function buildIdentityMap(
  sourceExercises: Array<{ id: string; name: string }>,
  oldCatalog: OldCatalogRow[],
): IdentityMapFile {
  const oldById = new Map(oldCatalog.map((row) => [row.id, row]))
  const oldByName = new Map<string, OldCatalogRow>()
  const oldBySlugName = new Map<string, OldCatalogRow>()

  for (const row of oldCatalog) {
    const nameKey = normalizeKey(row.name)
    if (!oldByName.has(nameKey)) oldByName.set(nameKey, row)
    const idAsName = normalizeKey(row.id.replace(/_/g, ' '))
    if (!oldBySlugName.has(idAsName)) oldBySlugName.set(idAsName, row)
  }

  const aliasByName = new Map<string, string>()
  for (const [alias, oldId] of Object.entries(SPLIT_LIBRARY_ALIASES)) {
    aliasByName.set(normalizeKey(alias), oldId)
  }

  const usedOldIds = new Set<string>()
  const bySourceId: Record<string, IdentityMatch> = {}

  for (const exercise of sourceExercises) {
    const nameKey = normalizeKey(exercise.name)
    let match: IdentityMatch | null = null

    const aliasOldId = aliasByName.get(nameKey)
    if (aliasOldId && oldById.has(aliasOldId) && !usedOldIds.has(aliasOldId)) {
      const old = oldById.get(aliasOldId)!
      match = {
        oldCatalogId: old.id,
        legacySlug: slugFromValue(old.id),
        matchType: 'alias',
      }
    }

    if (!match) {
      const byName = oldByName.get(nameKey)
      if (byName && !usedOldIds.has(byName.id)) {
        match = {
          oldCatalogId: byName.id,
          legacySlug: slugFromValue(byName.id),
          matchType: 'name',
        }
      }
    }

    if (!match) {
      const bySlugName = oldBySlugName.get(nameKey)
      if (bySlugName && !usedOldIds.has(bySlugName.id)) {
        match = {
          oldCatalogId: bySlugName.id,
          legacySlug: slugFromValue(bySlugName.id),
          matchType: 'slug-name',
        }
      }
    }

    if (match) {
      usedOldIds.add(match.oldCatalogId)
      bySourceId[exercise.id] = match
    }
  }

  const unmatchedOld = oldCatalog
    .filter((row) => !usedOldIds.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: slugFromValue(row.id),
    }))

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceCount: sourceExercises.length,
    oldCatalogCount: oldCatalog.length,
    matchedCount: Object.keys(bySourceId).length,
    newCount: sourceExercises.length - Object.keys(bySourceId).length,
    unmatchedOldCount: unmatchedOld.length,
    bySourceId,
    unmatchedOld,
  }
}

/**
 * Slug used to look up existing lift_types rows.
 * Never use a 4-digit source id as the slug — those would create new UUIDs.
 */
export function liftSlugForLibraryExercise(
  libraryId: string,
  name: string,
  legacySlug?: string | null,
): string {
  if (legacySlug?.trim()) return legacySlug.trim()
  const id = libraryId.trim()
  if (/^\d{4}$/.test(id)) {
    return slugFromValue(name) || `gv_${id}`
  }
  return slugFromValue(id || name)
}
