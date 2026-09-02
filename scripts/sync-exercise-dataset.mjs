/**
 * Copy the GitHub exercises-dataset into the app:
 * - data/exercises-dataset/exercises.json (complete source JSON)
 * - public/exercises/images + public/exercises/gifs
 * - public/offline/exercises.json (slim picker catalog)
 * - data/exercises-dataset/identity-map.json
 *
 * Does not delete data/data/exercises.json (old 873 catalog).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendor = path.join(root, 'vendor', 'exercises-dataset')
const destData = path.join(root, 'data', 'exercises-dataset')
const destImages = path.join(root, 'public', 'exercises', 'images')
const destGifs = path.join(root, 'public', 'exercises', 'gifs')
const EXPECTED = 1324

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

function linkOrCopy(src, dest) {
  ensureDir(path.dirname(dest))
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest)
    fs.linkSync(src, dest)
  } catch {
    fs.copyFileSync(src, dest)
  }
}

function normalizeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugFromValue(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function titleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const MUSCLE_LABELS = {
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

function muscleLabel(raw) {
  if (!raw) return 'Other'
  const key = String(raw).trim().toLowerCase()
  return MUSCLE_LABELS[key] ?? titleCase(raw)
}

const SPLIT_LIBRARY_ALIASES = {
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

function buildIdentityMap(source, oldCatalog) {
  const oldById = new Map(oldCatalog.map((row) => [row.id, row]))
  const oldByName = new Map()
  const oldBySlugName = new Map()
  for (const row of oldCatalog) {
    const nameKey = normalizeKey(row.name)
    if (!oldByName.has(nameKey)) oldByName.set(nameKey, row)
    const idAsName = normalizeKey(row.id.replace(/_/g, ' '))
    if (!oldBySlugName.has(idAsName)) oldBySlugName.set(idAsName, row)
  }
  const aliasByName = new Map()
  for (const [alias, oldId] of Object.entries(SPLIT_LIBRARY_ALIASES)) {
    aliasByName.set(normalizeKey(alias), oldId)
  }

  const usedOldIds = new Set()
  const bySourceId = {}

  for (const exercise of source) {
    const nameKey = normalizeKey(exercise.name)
    let match = null
    const aliasOldId = aliasByName.get(nameKey)
    if (aliasOldId && oldById.has(aliasOldId) && !usedOldIds.has(aliasOldId)) {
      const old = oldById.get(aliasOldId)
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
    sourceCount: source.length,
    oldCatalogCount: oldCatalog.length,
    matchedCount: Object.keys(bySourceId).length,
    newCount: source.length - Object.keys(bySourceId).length,
    unmatchedOldCount: unmatchedOld.length,
    bySourceId,
    unmatchedOld,
  }
}

function slimRecord(row, legacySlug) {
  const imageFile = String(row.image).replace(/^images\//, '')
  const secondary = Array.isArray(row.secondary_muscles) ? row.secondary_muscles : []
  const muscles = [
    ...new Set(
      [row.target, row.muscle_group, ...secondary]
        .filter(Boolean)
        .map((value) => muscleLabel(value)),
    ),
  ]
  return {
    id: row.id,
    name: row.name,
    primaryMuscles: [row.target].filter(Boolean),
    equipment: row.equipment,
    level: '',
    category: row.category,
    bodyPart: row.body_part,
    target: row.target,
    muscleGroup: row.muscle_group,
    secondaryMuscles: secondary,
    image: `/exercises/images/${imageFile}`,
    legacySlug,
    muscles,
  }
}

function main() {
  const vendorJson = path.join(vendor, 'data', 'exercises.json')
  if (!fs.existsSync(vendorJson)) {
    throw new Error(
      'vendor/exercises-dataset is missing. Clone https://github.com/hasaneyldrm/exercises-dataset into vendor/exercises-dataset',
    )
  }

  const source = JSON.parse(fs.readFileSync(vendorJson, 'utf8'))
  if (!Array.isArray(source) || source.length !== EXPECTED) {
    throw new Error(
      `Expected ${EXPECTED} source records, got ${Array.isArray(source) ? source.length : typeof source}`,
    )
  }

  ensureDir(destData)
  copyFile(vendorJson, path.join(destData, 'exercises.json'))
  copyFile(
    path.join(vendor, 'data', 'exercises.schema.json'),
    path.join(destData, 'exercises.schema.json'),
  )
  if (fs.existsSync(path.join(vendor, 'NOTICE.md'))) {
    copyFile(path.join(vendor, 'NOTICE.md'), path.join(destData, 'NOTICE.md'))
  }
  if (fs.existsSync(path.join(vendor, 'LICENSE'))) {
    copyFile(path.join(vendor, 'LICENSE'), path.join(destData, 'LICENSE'))
  }

  ensureDir(destImages)
  ensureDir(destGifs)

  const missingImages = []
  const missingGifs = []
  const mediaMismatch = []

  for (const row of source) {
    const imgFile = String(row.image || '').replace(/^images\//, '')
    const gifFile = String(row.gif_url || '').replace(/^videos\//, '')
    const srcImg = path.join(vendor, 'images', imgFile)
    const srcGif = path.join(vendor, 'videos', gifFile)
    if (!fs.existsSync(srcImg)) missingImages.push(`${row.id}:${imgFile}`)
    else linkOrCopy(srcImg, path.join(destImages, imgFile))
    if (!fs.existsSync(srcGif)) missingGifs.push(`${row.id}:${gifFile}`)
    else linkOrCopy(srcGif, path.join(destGifs, gifFile))

    const idFromImg = imgFile.slice(0, 4)
    const idFromGif = gifFile.slice(0, 4)
    const mediaFromImg = imgFile.replace(/^\d{4}-/, '').replace(/\.[^.]+$/, '')
    const mediaFromGif = gifFile.replace(/^\d{4}-/, '').replace(/\.[^.]+$/, '')
    if (
      idFromImg !== row.id ||
      idFromGif !== row.id ||
      mediaFromImg !== row.media_id ||
      mediaFromGif !== row.media_id
    ) {
      mediaMismatch.push(row.id)
    }
  }

  const oldPath = path.join(root, 'data', 'data', 'exercises.json')
  const oldCatalog = fs.existsSync(oldPath)
    ? JSON.parse(fs.readFileSync(oldPath, 'utf8'))
    : []
  const identity = buildIdentityMap(source, oldCatalog)
  fs.writeFileSync(
    path.join(destData, 'identity-map.json'),
    JSON.stringify(identity, null, 2),
  )

  const slim = source.map((row) =>
    slimRecord(row, identity.bySourceId[row.id]?.legacySlug ?? null),
  )
  ensureDir(path.join(root, 'public', 'offline'))
  fs.writeFileSync(
    path.join(root, 'public', 'offline', 'exercises.json'),
    JSON.stringify(slim),
  )

  const publicImages = fs.readdirSync(destImages).length
  const publicGifs = fs.readdirSync(destGifs).length

  const report = {
    sourceCount: source.length,
    importedCount: source.length,
    uniqueIds: new Set(source.map((row) => row.id)).size,
    missingImages,
    missingGifs,
    mediaMismatch,
    publicImages,
    publicGifs,
    matchedOldExercises: identity.matchedCount,
    newExercises: identity.newCount,
    unmatchedOldExercises: identity.unmatchedOldCount,
    oldCatalogKept: fs.existsSync(oldPath),
  }
  fs.writeFileSync(
    path.join(destData, 'import-report.json'),
    JSON.stringify(report, null, 2),
  )

  console.log(JSON.stringify(report, null, 2))
  if (missingImages.length || missingGifs.length || mediaMismatch.length) {
    process.exitCode = 1
  }
}

main()
