/**
 * Rebuild exercise lists for the 3 system splits using the Gym visual
 * 1,324-exercise catalog (data/exercises-dataset/exercises.json) as source of truth.
 * Uses local /exercises/images/… media — not the retired free-exercise-db set.
 *
 * Usage: node scripts/rebuild-system-split-exercises.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const env = Object.fromEntries(
  readFileSync(resolve(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
)

const MUSCLE_MAP = {
  chest: 'CHEST',
  'upper chest': 'CHEST',
  back: 'BACK',
  lats: 'BACK',
  'upper back': 'BACK',
  'lower back': 'BACK',
  shoulders: 'SHOULDERS',
  delts: 'SHOULDERS',
  biceps: 'BICEPS',
  triceps: 'TRICEPS',
  'upper legs': 'LEGS',
  quadriceps: 'LEGS',
  quads: 'LEGS',
  hamstrings: 'HAMSTRINGS',
  glutes: 'GLUTES',
  calves: 'CALVES',
  'lower legs': 'CALVES',
  waist: 'ABS',
  abs: 'ABS',
  abdominals: 'ABS',
  core: 'ABS',
  traps: 'TRAPS',
  trapezius: 'TRAPS',
  adductors: 'ADDUCTORS',
  abductors: 'ADDUCTORS',
  forearms: 'FOREARMS',
  cardio: 'ABS',
}

const CATALOG_PATH = resolve(root, 'data/exercises-dataset/exercises.json')

function loadCatalogRows() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  return raw.map((row) => ({
    id: String(row.id).padStart(4, '0'),
    name: row.name,
    category: row.category || 'strength',
    muscleGroup: row.muscle_group || row.target || '',
    image: row.image ? String(row.image).replace(/^images\//, '') : null,
  }))
}

const exercises = loadCatalogRows()
const byId = new Map(exercises.map((e) => [e.id, e]))
const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]))

/**
 * Legacy free-exercise display names → Gym visual catalog source ids.
 * Every system-split slot resolves through this map.
 */
const LEGACY_NAME_TO_CATALOG_ID = {
  'Barbell Squat': '0043',
  'Barbell Bench Press - Medium Grip': '0025',
  'Bent Over Barbell Row': '0027',
  'Side Lateral Raise': '0334',
  'Standing Calf Raises': '1372',
  Plank: '0464',
  'Barbell Deadlift': '0032',
  'Standing Military Press': '1456',
  Pullups: '0652',
  'Dumbbell Lunges': '0336',
  'Face Pull': '0203',
  'Seated Calf Raise': '0088',
  'Front Barbell Squat': '0042',
  'Incline Dumbbell Press': '0314',
  'Seated Cable Rows': '0180',
  'Lying Leg Curls': '0586',
  'Barbell Shrug': '0095',
  'Hanging Leg Raise': '0472',
  'Dips - Triceps Version': '0251',
  'Triceps Pushdown': '0200',
  'Barbell Curl': '0031',
  'Alternate Hammer Curl': '0313',
  'Romanian Deadlift': '0085',
  'Adductor/Groin': '1775',
  'Dumbbell Flyes': '0308',
  'Dumbbell Shoulder Press': '0405',
  'Cable Seated Lateral Raise': '0178',
  'Close-Grip Barbell Bench Press': '0030',
  'Cable Rope Overhead Triceps Extension': '0194',
  'Wide-Grip Lat Pulldown': '2616',
  'Reverse Flyes': '0602',
  'Dumbbell Shrug': '0406',
  'Alternate Incline Dumbbell Curl': '0318',
  'Hammer Curls': '0313',
  'Palms-Up Barbell Wrist Curl Over A Bench': '1412',
  'Barbell Hip Thrust': '1409',
  'Split Squats': '2368',
  'Seated Leg Curl': '0599',
  Adductor: '1775',
  'Air Bike': '0003',
  'Thigh Adductor': '1775',
  'Cable Crunch': '0226',
}

/** Existing DB short names → catalog id (reuse row, do not insert duplicate). */
const DB_NAME_TO_CATALOG_ID = {
  'Bench Press': '0025',
  Squat: '0043',
  'Front Squat': '0042',
  Deadlift: '0032',
  'Barbell Row': '0027',
  'Overhead Press': '1456',
  'Pull-Up': '0652',
  Dip: '0251',
  'Romanian Deadlift': '0085',
  'Barbell Bench Press': '0025',
  'Back Squat': '0043',
  'Cable Lateral Raise': '0178',
  'Seated Dumbbell Shoulder Press': '0405',
  'Incline Dumbbell Press': '0314',
  'Hammer Curl': '0313',
  'Barbell Curl': '0031',
  'Leg Press': '0739',
  'Standing Calf Raise': '1372',
  'Seated Calf Raise': '0088',
  'Hanging Leg Raise': '0472',
  'Barbell Shrug': '0095',
  'Close-Grip Bench Press': '0030',
  'Bulgarian Split Squat': '2368',
  'Barbell Hip Thrust': '1409',
  'Cable Crunch': '0226',
  'Lying Leg Curl': '0586',
  'Seated Leg Curl': '0599',
  'Chest-Supported Row': '0327',
  'Seated Cable Row': '0180',
  'Lat Pulldown': '2616',
  'Face Pull': '0203',
  'Dumbbell Lateral Raise': '0334',
  'Triceps Pushdown': '0200',
  'Rope Pushdown': '0200',
  'Overhead Rope Triceps Extension': '0194',
  'Incline Dumbbell Curl': '0318',
  'Walking Lunge': '1460',
}

function catalogEntry(catalogId) {
  const id = String(catalogId).padStart(4, '0')
  const e = byId.get(id)
  if (!e) throw new Error(`Exercise not in GIF catalog: ${id}`)
  return e
}

function entryFromLegacyName(fileName) {
  const catalogId = LEGACY_NAME_TO_CATALOG_ID[fileName]
  if (!catalogId) throw new Error(`No catalog mapping for: ${fileName}`)
  return catalogEntry(catalogId)
}

function muscleOf(entry) {
  const raw = (entry.muscleGroup || '').toLowerCase()
  const mapped = MUSCLE_MAP[raw]
  if (mapped) return mapped
  if (raw.includes('chest')) return 'CHEST'
  if (raw.includes('back') || raw.includes('lat')) return 'BACK'
  if (raw.includes('shoulder') || raw.includes('delt')) return 'SHOULDERS'
  if (raw.includes('bicep')) return 'BICEPS'
  if (raw.includes('tricep')) return 'TRICEPS'
  if (raw.includes('hamstring')) return 'HAMSTRINGS'
  if (raw.includes('glute')) return 'GLUTES'
  if (raw.includes('calf')) return 'CALVES'
  if (raw.includes('quad') || raw.includes('leg')) return 'LEGS'
  if (raw.includes('ab') || raw.includes('waist') || raw.includes('core'))
    return 'ABS'
  return 'BACK'
}

function categoryOf(entry) {
  const c = (entry.category || '').toLowerCase()
  if (c === 'cardio') return 'cardio'
  if (c.includes('stretch')) return 'accessory'
  return 'compound'
}

function slugOf(entry) {
  return `gv_${entry.id}`
}

function imageOf(entry) {
  return entry.image ? `/exercises/images/${entry.image}` : null
}

/** @type {Map<string, any>} */
let liftByNameLower = new Map()

async function loadLifts() {
  const { data, error } = await sb
    .from('lift_types')
    .select('id, slug, name, muscle_group, category, is_system, image_url, sort_order')
  if (error) throw error
  liftByNameLower = new Map(data.map((r) => [r.name.toLowerCase(), r]))
  return data
}

function findExistingForEntry(entry) {
  const direct = liftByNameLower.get(entry.name.toLowerCase())
  if (direct) return direct
  for (const [dbName, catalogId] of Object.entries(DB_NAME_TO_CATALOG_ID)) {
    if (catalogId === entry.id) {
      const hit = liftByNameLower.get(dbName.toLowerCase())
      if (hit) return hit
    }
  }
  return null
}

async function ensureLiftFromEntry(entry) {
  const existing = findExistingForEntry(entry)
  const muscle = muscleOf(entry)
  const category = categoryOf(entry)
  const image_url = imageOf(entry)

  if (existing) {
    const patch = {}
    if ((existing.muscle_group || '').toUpperCase() !== muscle) {
      patch.muscle_group = muscle
    }
    if (image_url && existing.image_url !== image_url) {
      // Prefer local GIF-catalog media over retired free-exercise-db URLs
      if (
        !existing.image_url ||
        existing.image_url.includes('yuhonas/free-exercise-db') ||
        !existing.image_url.startsWith('/exercises/')
      ) {
        patch.image_url = image_url
      }
    }
    if (Object.keys(patch).length) {
      const { error } = await sb
        .from('lift_types')
        .update(patch)
        .eq('id', existing.id)
      if (error) throw error
      Object.assign(existing, patch)
    }
    return existing
  }

  const row = {
    id: randomUUID(),
    slug: slugOf(entry),
    name: entry.name,
    category,
    sort_order: 100 + liftByNameLower.size,
    is_system: true,
    muscle_group: muscle,
    image_url,
  }

  const { data: slugHit } = await sb
    .from('lift_types')
    .select('id')
    .eq('slug', row.slug)
    .maybeSingle()
  if (slugHit) row.slug = `${row.slug}_${row.id.slice(0, 8)}`

  const { data, error } = await sb.from('lift_types').insert(row).select().single()
  if (error) throw error
  liftByNameLower.set(data.name.toLowerCase(), data)
  console.log('  + inserted lift:', data.name, `(${data.muscle_group})`)
  return data
}

async function lift(fileName) {
  return ensureLiftFromEntry(entryFromLegacyName(fileName))
}

const PROGRAM = {
  '81e41b82-3f7f-4734-9e11-554552c958ec': {
    label: 'Full Body Power · Full Body A',
    subtitle: 'Squat + press + pull · side delts · calves · core',
    slots: [
      { file: 'Barbell Squat', sets: 4, min: 4, max: 6 },
      { file: 'Barbell Bench Press - Medium Grip', sets: 4, min: 5, max: 6 },
      { file: 'Bent Over Barbell Row', sets: 3, min: 6, max: 8 },
      { file: 'Side Lateral Raise', sets: 3, min: 12, max: 15 },
      { file: 'Standing Calf Raises', sets: 3, min: 12, max: 20 },
      { file: 'Plank', sets: 3, min: 20, max: 40 },
    ],
  },
  'de442ffe-94c6-43f1-b730-5c439eae21c5': {
    label: 'Full Body Power · Full Body B',
    subtitle: 'Hinge + press + pull · lunges · rear delts · calves',
    slots: [
      { file: 'Barbell Deadlift', sets: 4, min: 3, max: 5 },
      { file: 'Standing Military Press', sets: 3, min: 6, max: 8 },
      { file: 'Pullups', sets: 3, min: 6, max: 10 },
      { file: 'Dumbbell Lunges', sets: 3, min: 8, max: 10 },
      { file: 'Face Pull', sets: 3, min: 12, max: 20 },
      { file: 'Seated Calf Raise', sets: 3, min: 12, max: 20 },
    ],
  },
  '394030eb-9ef0-4812-a9c5-e59ce847993e': {
    label: 'Full Body Power · Full Body C',
    subtitle: 'Front squat + incline · row · leg curl · traps · core',
    slots: [
      { file: 'Front Barbell Squat', sets: 4, min: 5, max: 6 },
      { file: 'Incline Dumbbell Press', sets: 3, min: 6, max: 10 },
      { file: 'Seated Cable Rows', sets: 3, min: 6, max: 10 },
      { file: 'Lying Leg Curls', sets: 3, min: 10, max: 15 },
      { file: 'Barbell Shrug', sets: 3, min: 10, max: 15 },
      { file: 'Hanging Leg Raise', sets: 3, min: 12, max: 20 },
    ],
  },
  '1a6d2245-c7b8-4cde-baad-1ab2f8303439': {
    label: 'PPL · Push A',
    subtitle: 'Chest · shoulders · side delts · triceps',
    slots: [
      { file: 'Barbell Bench Press - Medium Grip', sets: 4, min: 8, max: 12 },
      { file: 'Incline Dumbbell Press', sets: 3, min: 8, max: 12 },
      { file: 'Standing Military Press', sets: 3, min: 8, max: 12 },
      { file: 'Side Lateral Raise', sets: 3, min: 12, max: 15 },
      { file: 'Dips - Triceps Version', sets: 3, min: 8, max: 12 },
      { file: 'Triceps Pushdown', sets: 3, min: 10, max: 15 },
    ],
  },
  'cd0ed589-aa84-499c-95d9-1edb8a7e4f2e': {
    label: 'PPL · Pull A',
    subtitle: 'Vertical + horizontal pull · rear delts · traps · biceps',
    slots: [
      { file: 'Pullups', sets: 4, min: 6, max: 10 },
      { file: 'Bent Over Barbell Row', sets: 4, min: 6, max: 10 },
      { file: 'Face Pull', sets: 3, min: 12, max: 20 },
      { file: 'Barbell Shrug', sets: 3, min: 10, max: 15 },
      { file: 'Barbell Curl', sets: 3, min: 8, max: 12 },
      { file: 'Alternate Hammer Curl', sets: 3, min: 10, max: 15 },
    ],
  },
  '3da7996f-6595-43ce-9301-9008b01de422': {
    label: 'PPL · Legs A',
    subtitle: 'Squat · RDL · lunges · curl · calves · adductors · core',
    slots: [
      { file: 'Barbell Squat', sets: 4, min: 6, max: 10 },
      { file: 'Romanian Deadlift', sets: 3, min: 8, max: 12 },
      { file: 'Dumbbell Lunges', sets: 3, min: 10, max: 12 },
      { file: 'Lying Leg Curls', sets: 3, min: 10, max: 15 },
      { file: 'Standing Calf Raises', sets: 3, min: 12, max: 20 },
      { file: 'Adductor/Groin', sets: 3, min: 10, max: 15 },
      { file: 'Hanging Leg Raise', sets: 3, min: 12, max: 20 },
    ],
  },
  '308d51be-ea7a-4aad-999a-3902d6becf49': {
    label: 'PPL · Push B',
    subtitle: 'Incline focus · fly · DB press · laterals · close-grip · overhead tri',
    slots: [
      { file: 'Incline Dumbbell Press', sets: 4, min: 8, max: 12 },
      { file: 'Dumbbell Flyes', sets: 3, min: 10, max: 15 },
      { file: 'Dumbbell Shoulder Press', sets: 3, min: 8, max: 12 },
      { file: 'Cable Seated Lateral Raise', sets: 3, min: 12, max: 15 },
      { file: 'Close-Grip Barbell Bench Press', sets: 3, min: 8, max: 12 },
      { file: 'Cable Rope Overhead Triceps Extension', sets: 3, min: 10, max: 15 },
    ],
  },
  'f78bdbea-ff5a-4c2b-b978-c86acddc23f3': {
    label: 'PPL · Pull B',
    subtitle: 'Pulldown + row · rear delts · shrugs · 2 curls · forearms',
    slots: [
      { file: 'Wide-Grip Lat Pulldown', sets: 4, min: 8, max: 12 },
      { file: 'Seated Cable Rows', sets: 4, min: 8, max: 12 },
      { file: 'Reverse Flyes', sets: 3, min: 12, max: 15 },
      { file: 'Dumbbell Shrug', sets: 3, min: 10, max: 15 },
      { file: 'Alternate Incline Dumbbell Curl', sets: 3, min: 10, max: 15 },
      { file: 'Hammer Curls', sets: 3, min: 10, max: 15 },
      { file: 'Palms-Up Barbell Wrist Curl Over A Bench', sets: 2, min: 12, max: 20 },
    ],
  },
  '6c005039-9d4a-4710-a45e-fbe08d7b502b': {
    label: 'PPL · Legs B',
    subtitle: 'Front squat · hip thrust · split squat · curl · calves · adductors · core',
    slots: [
      { file: 'Front Barbell Squat', sets: 4, min: 8, max: 12 },
      { file: 'Barbell Hip Thrust', sets: 3, min: 10, max: 12 },
      { file: 'Split Squats', sets: 3, min: 10, max: 12 },
      { file: 'Seated Leg Curl', sets: 3, min: 10, max: 15 },
      { file: 'Seated Calf Raise', sets: 3, min: 12, max: 20 },
      { file: 'Adductor', sets: 3, min: 10, max: 15 },
      { file: 'Air Bike', sets: 3, min: 15, max: 20 },
    ],
  },
  '8009d5c1-8108-4a45-8f47-a717587925e1': {
    label: 'Upper/Lower · Upper A — Strength',
    subtitle: 'Heavy bench · row · OHP · pull-up · light laterals',
    slots: [
      { file: 'Barbell Bench Press - Medium Grip', sets: 4, min: 4, max: 6 },
      { file: 'Bent Over Barbell Row', sets: 4, min: 4, max: 6 },
      { file: 'Standing Military Press', sets: 3, min: 4, max: 6 },
      { file: 'Pullups', sets: 3, min: 5, max: 8 },
      { file: 'Side Lateral Raise', sets: 2, min: 12, max: 15 },
    ],
  },
  'afac58df-dae4-49ec-98e1-4b2b8f1da1fb': {
    label: 'Upper/Lower · Lower A — Strength',
    subtitle: 'Heavy squat · RDL · calves · core',
    slots: [
      { file: 'Barbell Squat', sets: 4, min: 4, max: 6 },
      { file: 'Romanian Deadlift', sets: 3, min: 6, max: 8 },
      { file: 'Standing Calf Raises', sets: 3, min: 12, max: 20 },
      { file: 'Plank', sets: 3, min: 20, max: 40 },
      { file: 'Thigh Adductor', sets: 2, min: 12, max: 15 },
    ],
  },
  'b4c93dee-5aad-4280-9dfa-423a9ebbff2c': {
    label: 'Upper/Lower · Upper B — Hypertrophy',
    subtitle: 'Incline volume · row · laterals · rear delts · 2 arm moves',
    slots: [
      { file: 'Incline Dumbbell Press', sets: 4, min: 8, max: 12 },
      { file: 'Seated Cable Rows', sets: 4, min: 8, max: 12 },
      { file: 'Side Lateral Raise', sets: 3, min: 12, max: 15 },
      { file: 'Face Pull', sets: 3, min: 12, max: 20 },
      { file: 'Alternate Incline Dumbbell Curl', sets: 3, min: 10, max: 15 },
      { file: 'Triceps Pushdown', sets: 3, min: 10, max: 15 },
    ],
  },
  'fea674c4-02be-4de2-9492-a382921410b0': {
    label: 'Upper/Lower · Lower B — Hypertrophy',
    subtitle: 'Front squat · lunges · curl · calves · adductors · core',
    slots: [
      { file: 'Front Barbell Squat', sets: 3, min: 10, max: 15 },
      { file: 'Dumbbell Lunges', sets: 3, min: 10, max: 12 },
      { file: 'Lying Leg Curls', sets: 3, min: 10, max: 15 },
      { file: 'Seated Calf Raise', sets: 3, min: 12, max: 20 },
      { file: 'Adductor', sets: 3, min: 10, max: 15 },
      { file: 'Cable Crunch', sets: 3, min: 12, max: 20 },
    ],
  },
}

async function fetchSummary(dayIds) {
  const { data, error } = await sb
    .from('split_days')
    .select(
      'id, name, day_order, subtitle, split_id, split_day_exercises(exercise_order, target_sets, target_reps_min, target_reps_max, lift_types(name, muscle_group))',
    )
    .in('id', dayIds)
  if (error) throw error
  return data
}

async function main() {
  console.log('Loading GIF catalog + lift_types…')
  await loadLifts()

  for (const day of Object.values(PROGRAM)) {
    for (const slot of day.slots) entryFromLegacyName(slot.file)
  }
  console.log('All programmed exercises mapped to GIF catalog ✓')

  const dayIds = Object.keys(PROGRAM)
  const before = await fetchSummary(dayIds)

  console.log('\n========== BEFORE ==========')
  printSummary(before)

  console.log('\nApplying rebuild…')
  for (const [dayId, day] of Object.entries(PROGRAM)) {
    console.log(`\n→ ${day.label}`)
    await setSubtitle(dayId, day.subtitle)
    const resolved = []
    for (const slot of day.slots) {
      const lt = await lift(slot.file)
      resolved.push({ slot, lt })
    }
    const { error: delErr } = await sb
      .from('split_day_exercises')
      .delete()
      .eq('split_day_id', dayId)
    if (delErr) throw delErr

    const rows = resolved.map(({ slot, lt }, i) => ({
      id: randomUUID(),
      split_day_id: dayId,
      lift_type_id: lt.id,
      exercise_order: i + 1,
      target_sets: slot.sets,
      target_reps_min: slot.min,
      target_reps_max: slot.max,
    }))
    const { error: insErr } = await sb.from('split_day_exercises').insert(rows)
    if (insErr) throw insErr

    for (const { slot, lt } of resolved) {
      console.log(
        `   ${lt.name} [${lt.muscle_group}] ${slot.sets}×${slot.min}–${slot.max}`,
      )
    }
  }

  const after = await fetchSummary(dayIds)
  console.log('\n========== AFTER ==========')
  printSummary(after)
  console.log('\nDone.')
}

async function setSubtitle(dayId, subtitle) {
  const { error } = await sb.from('split_days').update({ subtitle }).eq('id', dayId)
  if (error) throw error
}

function printSummary(days) {
  const bySplit = new Map()
  for (const d of days) {
    const list = bySplit.get(d.split_id) ?? []
    list.push(d)
    bySplit.set(d.split_id, list)
  }
  const names = {
    'c1892fda-7b2c-48f7-9766-30237caac11a': 'Full Body Power',
    '97cc0d18-4348-4cc3-a232-fab4b99b3e42': 'Push / Pull / Legs',
    'a3d9d4fd-3bf1-4bfa-a212-08d971ea3dc1': 'Upper / Lower',
  }
  for (const [sid, label] of Object.entries(names)) {
    console.log(`\n### ${label}`)
    const list = (bySplit.get(sid) ?? []).sort(
      (a, b) => a.day_order - b.day_order,
    )
    for (const d of list) {
      console.log(`  ${d.name} — ${d.subtitle || ''}`)
      const ex = [...(d.split_day_exercises ?? [])].sort(
        (a, b) => a.exercise_order - b.exercise_order,
      )
      for (const row of ex) {
        console.log(
          `    - ${row.lift_types?.name} (${row.target_sets}×${row.target_reps_min}–${row.target_reps_max})`,
        )
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
