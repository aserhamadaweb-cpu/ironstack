import type { IdentityMapFile, IdentityMatch } from '@/lib/exercises/types'
import { normalizeKey, slugFromValue } from '@/lib/exercises/normalizers'

/**
 * Curated map from ready-made / seeded / legacy free-exercise display names
 * to Gym visual catalog source ids (4-digit). Keeps name-based resolution on
 * the GIF catalog when splits still store old lift_types labels.
 */
export const SPLIT_LIBRARY_ALIASES: Record<string, string> = {
  // Ready-made / UI-friendly names
  'Barbell Bench Press': '0025',
  'Seated Dumbbell Shoulder Press': '0405',
  'Incline Dumbbell Press': '0314',
  'Cable Lateral Raise': '0178',
  'Overhead Rope Triceps Extension': '0194',
  'Triceps Pushdown': '0200',
  Deadlift: '0032',
  'Pull-Up': '0652',
  Pullups: '0652',
  'Chest-Supported Row': '0327',
  'Face Pull': '0203',
  'Barbell Curl': '0031',
  'Incline Dumbbell Curl': '0318',
  'Back Squat': '0043',
  'Romanian Deadlift': '0085',
  'Leg Press': '0739',
  'Seated Leg Curl': '0599',
  'Standing Calf Raise': '1372',
  'Standing Calf Raises': '1372',
  'Hanging Leg Raise': '0472',
  'Barbell Row': '0027',
  'Standing Overhead Press': '1456',
  'Overhead Press': '1456',
  'Lat Pulldown': '2616',
  'Wide-Grip Lat Pulldown': '2616',
  'Dumbbell Lateral Raise': '0334',
  'Side Lateral Raise': '0334',
  'Skull Crusher': '0060',
  'Hammer Curl': '0313',
  'Hammer Curls': '0313',
  'Bulgarian Split Squat': '2368',
  'Split Squats': '2368',
  'Leg Extension': '0585',
  'Leg Extensions': '0585',
  'Seated Calf Raise': '0088',
  Plank: '0464',
  'Arnold Press': '2137',
  'Arnold Dumbbell Press': '2137',
  'Cable Fly': '0188',
  'Flat Bench Cable Flyes': '0188',
  'Straight-Arm Pulldown': '0238',
  'Cable Curl': '0868',
  'Standing Biceps Cable Curl': '0868',
  'Rope Pushdown': '0200',
  'Triceps Pushdown - Rope Attachment': '0200',
  'Front Squat': '0042',
  'Front Barbell Squat': '0042',
  'Barbell Hip Thrust': '1409',
  'Walking Lunge': '1460',
  'Barbell Walking Lunge': '1460',
  'Dumbbell Lunges': '0336',
  'Lying Leg Curl': '0586',
  'Lying Leg Curls': '0586',
  'Cable Crunch': '0226',
  'Seated Cable Row': '0180',
  'Seated Cable Rows': '0180',
  'Dumbbell Curl': '0294',
  'Seated Dumbbell Curl': '0294',
  'Chest Dip': '0251',
  'Dips - Chest Version': '0251',
  'Dips - Triceps Version': '0251',
  Dip: '0251',
  'Push-Up (Burnout)': '0662',
  Pushups: '0662',
  'Rear-Delt Fly': '0602',
  'Reverse Flyes': '0602',
  'Cable Rear Delt Fly': '0602',
  'Cable Front Raise': '0162',
  'Front Cable Raise': '0162',
  'Barbell Shrug': '0095',
  'Close-Grip Bench Press': '0030',
  'Close-Grip Barbell Bench Press': '0030',
  'Overhead Rope Extension': '0194',
  'Cable Rope Overhead Triceps Extension': '0194',
  'Cable Hammer Curl': '0165',
  'Cable Hammer Curls - Rope Attachment': '0165',
  // Legacy free-exercise-db labels still present on some lift_types rows
  'Barbell Squat': '0043',
  Squat: '0043',
  'Barbell Bench Press - Medium Grip': '0025',
  'Bench Press': '0025',
  'Bent Over Barbell Row': '0027',
  'Barbell Deadlift': '0032',
  'Standing Military Press': '1456',
  'Dumbbell Shoulder Press': '0405',
  'Seated Dumbbell Press': '0405',
  'Cable Seated Lateral Raise': '0178',
  'Alternate Hammer Curl': '0313',
  'Alternate Incline Dumbbell Curl': '0318',
  'Dumbbell Flyes': '0308',
  'Dumbbell Shrug': '0406',
  'Palms-Up Barbell Wrist Curl Over A Bench': '1412',
  'Adductor/Groin': '1775',
  Adductor: '1775',
  'Thigh Adductor': '1775',
  'Air Bike': '0003',
  'EZ-Bar Skullcrusher': '0060',
  'Lying T-Bar Row': '0327',
}

const ALIAS_BY_KEY: Map<string, string> = (() => {
  const map = new Map<string, string>()
  for (const [name, id] of Object.entries(SPLIT_LIBRARY_ALIASES)) {
    map.set(normalizeKey(name), id)
  }
  return map
})()

/** Resolve a display / legacy name to a Gym visual catalog id, if known. */
export function resolveSplitAliasId(name: string): string | null {
  const key = normalizeKey(name)
  if (!key) return null
  return ALIAS_BY_KEY.get(key) ?? null
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
  const oldByName = new Map<string, OldCatalogRow>()
  const oldBySlugName = new Map<string, OldCatalogRow>()

  for (const row of oldCatalog) {
    const nameKey = normalizeKey(row.name)
    if (!oldByName.has(nameKey)) oldByName.set(nameKey, row)
    const slugKey = normalizeKey(row.id.replace(/_/g, ' '))
    if (!oldBySlugName.has(slugKey)) oldBySlugName.set(slugKey, row)
  }

  const bySourceId: Record<string, IdentityMatch> = {}
  const usedOldIds = new Set<string>()

  for (const source of sourceExercises) {
    const nameKey = normalizeKey(source.name)
    let match: IdentityMatch | null = null

    const byName = oldByName.get(nameKey)
    if (byName) {
      match = {
        oldCatalogId: byName.id,
        legacySlug: slugFromValue(byName.id),
        matchType: 'name',
      }
    } else {
      const bySlugName = oldBySlugName.get(nameKey)
      if (bySlugName) {
        match = {
          oldCatalogId: bySlugName.id,
          legacySlug: slugFromValue(bySlugName.id),
          matchType: 'slug-name',
        }
      }
    }

    if (match) {
      bySourceId[source.id] = match
      usedOldIds.add(match.oldCatalogId)
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

export function liftSlugForLibraryExercise(
  sourceId: string,
  name: string,
  legacySlug?: string | null,
): string {
  if (legacySlug?.trim()) return legacySlug.trim()
  if (/^\d{1,4}$/.test(sourceId.trim())) {
    return `gv_${sourceId.trim().padStart(4, '0')}`
  }
  return slugFromValue(name) || slugFromValue(sourceId)
}
