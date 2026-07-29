import fs from 'node:fs'
import path from 'node:path'
import type { LibraryExercise } from '@/lib/exercise-library'
import type { SplitDetail } from '@/lib/split-data'

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
  images: string[]
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function readDataset(): RawExercise[] {
  const file = path.join(process.cwd(), 'data', 'data', 'exercises.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RawExercise[]
}

/** Reads and slims the free-exercise-db dataset (server-side only). */
export function loadExerciseLibrary(): LibraryExercise[] {
  const raw = readDataset()

  return raw.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    muscles: [
      ...new Set(
        (exercise.primaryMuscles.length ? exercise.primaryMuscles : ['other']).map(
          (muscle) => MUSCLE_LABELS[muscle] ?? titleCase(muscle)
        )
      ),
    ],
    equipment: titleCase(exercise.equipment ?? 'None'),
    level: titleCase(exercise.level ?? ''),
    image: exercise.images?.[0] ? `${IMAGE_BASE}${exercise.images[0]}` : null,
  }))
}

/**
 * Curated map from the ready-made split exercise names (see `lib/split-data.ts`)
 * to specific free-exercise-db entry ids, so pre-built splits pull the same
 * real photo thumbnails the builder uses — hand-picked instead of fuzzy-matched
 * so shared exercises stay accurate and consistent.
 */
const SPLIT_IMAGE_ALIASES: Record<string, string> = {
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

let idImageCache: Map<string, string> | null = null

/** Builds (once) a map of dataset id → first image URL. */
function idImageMap(): Map<string, string> {
  if (idImageCache) return idImageCache
  const map = new Map<string, string>()
  for (const exercise of readDataset()) {
    if (exercise.images?.[0]) {
      map.set(exercise.id, `${IMAGE_BASE}${exercise.images[0]}`)
    }
  }
  idImageCache = map
  return map
}

/** Resolves a ready-made split exercise name to a real thumbnail URL, if known. */
export function resolveExerciseImage(name: string): string | null {
  const id = SPLIT_IMAGE_ALIASES[name]
  if (!id) return null
  return idImageMap().get(id) ?? null
}

/** Returns a copy of the split with real photo thumbnails filled in per exercise. */
export function withResolvedImages(split: SplitDetail): SplitDetail {
  return {
    ...split,
    schedule: split.schedule.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        image: exercise.image ?? resolveExerciseImage(exercise.name) ?? undefined,
      })),
    })),
  }
}
