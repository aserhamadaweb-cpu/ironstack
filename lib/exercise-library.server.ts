import fs from 'node:fs'
import path from 'node:path'
import type { LibraryExercise } from '@/lib/exercise-library'
import type { MuscleGroup, SplitDetail } from '@/lib/split-data'

const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

/** Maps free-exercise-db primaryMuscles values to IronStack display labels. */
const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abdominals: 'Abs',
  forearms: 'Forearms',
  traps: 'Traps',
  neck: 'Neck',
  abductors: 'Abductors',
  adductors: 'Adductors',
}

type RawExercise = {
  id: string
  name: string
  primaryMuscles: string[]
  equipment: string | null
  level: string
  category?: string | null
  images: string[]
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readDataset(): RawExercise[] {
  const file = path.join(process.cwd(), 'data', 'data', 'exercises.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RawExercise[]
}

function toLibraryExercise(exercise: RawExercise): LibraryExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    muscles: [
      ...new Set(
        (exercise.primaryMuscles.length ? exercise.primaryMuscles : ['other']).map(
          (muscle) => MUSCLE_LABELS[muscle] ?? titleCase(muscle),
        ),
      ),
    ],
    equipment: titleCase(exercise.equipment ?? 'None'),
    level: titleCase(exercise.level ?? ''),
    category: exercise.category?.trim().toLowerCase() || null,
    image: exercise.images?.[0] ? `${IMAGE_BASE}${exercise.images[0]}` : null,
  }
}

/** Reads and slims the free-exercise-db dataset (server-side only). */
export function loadExerciseLibrary(): LibraryExercise[] {
  return readDataset().map(toLibraryExercise)
}

/**
 * Curated map from ready-made / seeded split exercise names to free-exercise-db
 * entry ids — same catalog the custom split builder searches.
 */
const SPLIT_LIBRARY_ALIASES: Record<string, string> = {
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

let libraryById: Map<string, LibraryExercise> | null = null
let libraryByNormalizedName: Map<string, LibraryExercise> | null = null

function libraryIndexes() {
  if (libraryById && libraryByNormalizedName) {
    return { byId: libraryById, byName: libraryByNormalizedName }
  }

  const byId = new Map<string, LibraryExercise>()
  const byName = new Map<string, LibraryExercise>()
  for (const entry of loadExerciseLibrary()) {
    byId.set(entry.id, entry)
    const key = normalizeName(entry.name)
    if (!byName.has(key)) byName.set(key, entry)
    // Also index the dataset id as a spaced name (Barbell_Squat → barbell squat).
    const idAsName = normalizeName(entry.id.replace(/_/g, ' '))
    if (!byName.has(idAsName)) byName.set(idAsName, entry)
  }

  libraryById = byId
  libraryByNormalizedName = byName
  return { byId, byName }
}

/**
 * Resolve an exercise name (from seeded splits / lift_types) to the same
 * free-exercise-db entry the custom split builder uses.
 */
export function resolveLibraryExercise(name: string): LibraryExercise | null {
  const trimmed = name.trim()
  if (!trimmed) return null

  const { byId, byName } = libraryIndexes()

  const aliasId = SPLIT_LIBRARY_ALIASES[trimmed]
  if (aliasId) {
    const aliased = byId.get(aliasId)
    if (aliased) return aliased
  }

  const exact = byName.get(normalizeName(trimmed))
  if (exact) return exact

  // Soft contains match — prefer shorter library names to avoid odd hits.
  const needle = normalizeName(trimmed)
  let best: LibraryExercise | null = null
  for (const [key, entry] of byName) {
    if (!key.includes(needle) && !needle.includes(key)) continue
    if (!best || entry.name.length < best.name.length) best = entry
  }
  return best
}

/** Resolves a ready-made split exercise name to a real thumbnail URL, if known. */
export function resolveExerciseImage(name: string): string | null {
  return resolveLibraryExercise(name)?.image ?? null
}

/**
 * Enrich a split (recommended or custom) with photos + muscle labels from
 * `data/data/exercises.json` — the same catalog as Create Your Own Split.
 */
export function enrichSplitFromLibrary(split: SplitDetail): SplitDetail {
  const muscleMap: Record<string, MuscleGroup> = {
    Chest: 'Chest',
    Back: 'Back',
    Shoulders: 'Shoulders',
    Biceps: 'Biceps',
    Triceps: 'Triceps',
    Quads: 'Quads',
    Hamstrings: 'Hamstrings',
    Glutes: 'Glutes',
    Calves: 'Calves',
    Abs: 'Core',
    Core: 'Core',
    Traps: 'Traps',
  }

  return {
    ...split,
    schedule: split.schedule.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => {
        const library = resolveLibraryExercise(exercise.name)
        const rawMuscle = library?.muscles[0]
        const muscle = rawMuscle
          ? (muscleMap[rawMuscle] ?? exercise.muscle)
          : exercise.muscle
        return {
          ...exercise,
          name: library?.name ?? exercise.name,
          category:
            library?.category === 'cardio'
              ? 'cardio'
              : (exercise.category ?? library?.category ?? undefined),
          image: library?.image ?? exercise.image ?? undefined,
          muscle,
        }
      }),
    })),
  }
}

/** @deprecated Prefer enrichSplitFromLibrary — kept for older call sites. */
export function withResolvedImages(split: SplitDetail): SplitDetail {
  return enrichSplitFromLibrary(split)
}
