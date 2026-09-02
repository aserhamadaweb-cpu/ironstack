/**
 * Rebuild exercise lists for the 3 system splits using data/exercises-dataset/exercises.json
 * as the source of truth. Reuses existing lift_types by case-insensitive name
 * (and known aliases); inserts only genuinely new system lifts.
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

const IMG =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

const MUSCLE_MAP = {
  abdominals: 'ABS',
  adductors: 'ADDUCTORS',
  biceps: 'BICEPS',
  calves: 'CALVES',
  chest: 'CHEST',
  forearms: 'FOREARMS',
  glutes: 'GLUTES',
  hamstrings: 'HAMSTRINGS',
  lats: 'BACK',
  'lower back': 'BACK',
  'middle back': 'BACK',
  quadriceps: 'LEGS',
  shoulders: 'SHOULDERS',
  traps: 'TRAPS',
  triceps: 'TRICEPS',
}

/** Existing DB short names → exercise-file canonical name (for metadata). */
const FILE_NAME_FOR_EXISTING = {
  'Bench Press': 'Barbell Bench Press - Medium Grip',
  Squat: 'Barbell Squat',
  'Front Squat': 'Front Barbell Squat',
  Deadlift: 'Barbell Deadlift',
  'Barbell Row': 'Bent Over Barbell Row',
  'Overhead Press': 'Standing Military Press',
  'Pull-Up': 'Pullups',
  Dip: 'Dips - Triceps Version',
  'Romanian Deadlift': 'Romanian Deadlift',
  'Alternate Hammer Curl': 'Alternate Hammer Curl',
  'Alternate Incline Dumbbell Curl': 'Alternate Incline Dumbbell Curl',
  Adductor: 'Adductor',
  'Adductor/Groin': 'Adductor/Groin',
  'Air Bike': 'Air Bike',
}

/**
 * When selecting an exercise by file name, also accept these existing DB names
 * as equivalents (reuse row, do not insert duplicate).
 */
const REUSE_ALIASES = {
  'Barbell Bench Press - Medium Grip': ['Bench Press'],
  'Barbell Squat': ['Squat'],
  'Front Barbell Squat': ['Front Squat'],
  'Barbell Deadlift': ['Deadlift'],
  'Bent Over Barbell Row': ['Barbell Row'],
  'Standing Military Press': ['Overhead Press'],
  Pullups: ['Pull-Up'],
  'Dips - Triceps Version': ['Dip'],
}

const CATALOG_PATH = resolve(root, 'data/exercises-dataset/exercises.json')

function loadCatalogRows() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  return raw.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category || 'strength',
    primaryMuscles: [row.target || row.muscle_group].filter(Boolean),
    images: row.image ? [String(row.image).replace(/^images\//, '')] : [],
  }))
}

const exercises = loadCatalogRows()
const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]))

function fileEntry(name) {
  const e = byName.get(name.toLowerCase())
  if (!e) throw new Error(`Exercise not in file: ${name}`)
  return e
}

function muscleOf(entry) {
  const raw = (entry.primaryMuscles?.[0] || '').toLowerCase()
  const mapped = MUSCLE_MAP[raw]
  if (!mapped) throw new Error(`No muscle map for ${raw} (${entry.name})`)
  return mapped
}

function categoryOf(entry) {
  if (entry.equipment === 'body only') return 'bodyweight'
  if (entry.mechanic === 'isolation') return 'accessory'
  return 'compound'
}

function slugOf(entry) {
  return entry.id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function imageOf(entry) {
  const path = entry.images?.[0]
  return path ? `${IMG}/${path}` : null
}

/** @type {Map<string, any>} */
let liftByNameLower = new Map()

async function loadLifts() {
  const { data, error } = await sb
    .from('lift_types')
    .select('id, slug, name, muscle_group, category, is_system, image_url, sort_order')
  if (error) throw error
  liftByNameLower = new Map(
    data.map((r) => [r.name.toLowerCase(), r]),
  )
  return data
}

function findExisting(fileName) {
  const direct = liftByNameLower.get(fileName.toLowerCase())
  if (direct) return direct
  for (const alias of REUSE_ALIASES[fileName] ?? []) {
    const hit = liftByNameLower.get(alias.toLowerCase())
    if (hit) return hit
  }
  return null
}

async function ensureLift(fileName) {
  const existing = findExisting(fileName)
  const entry = fileEntry(fileName)
  const muscle = muscleOf(entry)
  const category = categoryOf(entry)
  const image_url = imageOf(entry)

  if (existing) {
    const patch = {}
    if ((existing.muscle_group || '').toUpperCase() !== muscle) {
      patch.muscle_group = muscle
    } else if (existing.muscle_group !== muscle) {
      patch.muscle_group = muscle
    }
    if (!existing.image_url && image_url) patch.image_url = image_url
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

  // Slug collision: append suffix
  const { data: slugHit } = await sb
    .from('lift_types')
    .select('id')
    .eq('slug', row.slug)
    .maybeSingle()
  if (slugHit) row.slug = `${row.slug}_${row.id.slice(0, 8)}`

  const { data, error } = await sb
    .from('lift_types')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  liftByNameLower.set(data.name.toLowerCase(), data)
  console.log('  + inserted lift:', data.name, `(${data.muscle_group})`)
  return data
}

/**
 * Prefer reusing DB short name when alias maps to it; otherwise file name.
 * @param {string} fileName
 */
async function lift(fileName) {
  return ensureLift(fileName)
}

/** @typedef {{ file: string, sets: number, min: number, max: number }} Slot */

/**
 * @param {string} dayId
 * @param {Slot[]} slots
 */
async function replaceDay(dayId, slots) {
  const { error: delErr } = await sb
    .from('split_day_exercises')
    .delete()
    .eq('split_day_id', dayId)
  if (delErr) throw delErr

  const rows = []
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const lt = await lift(slot.file)
    rows.push({
      id: randomUUID(),
      split_day_id: dayId,
      lift_type_id: lt.id,
      exercise_order: i + 1,
      target_sets: slot.sets,
      target_reps_min: slot.min,
      target_reps_max: slot.max,
    })
  }

  const { error: insErr } = await sb.from('split_day_exercises').insert(rows)
  if (insErr) throw insErr
  return rows.map((r, i) => ({
    order: i + 1,
    name: liftByNameLower.get(
      [...liftByNameLower.entries()].find(([, v]) => v.id === r.lift_type_id)?.[0] ?? '',
    ),
    lift_type_id: r.lift_type_id,
    sets: r.target_sets,
    reps: `${r.target_reps_min}–${r.target_reps_max}`,
    file: slots[i].file,
  }))
}

async function setSubtitle(dayId, subtitle) {
  const { error } = await sb
    .from('split_days')
    .update({ subtitle })
    .eq('id', dayId)
  if (error) throw error
}

const PROGRAM = {
  // Full Body Power
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

  // PPL — Push A
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
  // PPL — Pull A
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
  // PPL — Legs A
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
  // PPL — Push B
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
  // PPL — Pull B
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
  // PPL — Legs B
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

  // Upper / Lower
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
  console.log('Loading lift_types…')
  await loadLifts()

  // Pre-validate all file names exist
  for (const day of Object.values(PROGRAM)) {
    for (const slot of day.slots) fileEntry(slot.file)
  }
  console.log('All programmed exercises found in exercises.json ✓')

  const dayIds = Object.keys(PROGRAM)
  const before = await fetchSummary(dayIds)

  console.log('\n========== BEFORE ==========')
  printSummary(before)

  console.log('\nApplying rebuild…')
  for (const [dayId, day] of Object.entries(PROGRAM)) {
    console.log(`\n→ ${day.label}`)
    await setSubtitle(dayId, day.subtitle)
    const resolved = []
    for (let i = 0; i < day.slots.length; i++) {
      const slot = day.slots[i]
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

  // Normalize muscle groups on all lifts we touched / existing system lifts used
  const { data: allLifts } = await sb
    .from('lift_types')
    .select('id, name, muscle_group')
  for (const row of allLifts ?? []) {
    const fileName =
      FILE_NAME_FOR_EXISTING[row.name] ||
      (byName.has(row.name.toLowerCase()) ? row.name : null)
    if (!fileName) continue
    const entry = byName.get(fileName.toLowerCase())
    if (!entry) continue
    const muscle = muscleOf(entry)
    if ((row.muscle_group || '') !== muscle) {
      await sb
        .from('lift_types')
        .update({ muscle_group: muscle })
        .eq('id', row.id)
    }
  }

  const after = await fetchSummary(dayIds)
  console.log('\n========== AFTER ==========')
  printSummary(after)
  console.log('\nDone.')
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
      for (const e of ex) {
        console.log(
          `    ${e.exercise_order}. ${e.lift_types?.name} (${e.lift_types?.muscle_group}) — ${e.target_sets}×${e.target_reps_min}–${e.target_reps_max}`,
        )
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
