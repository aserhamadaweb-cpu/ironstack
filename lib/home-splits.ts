import type { LibraryExercise } from '@/lib/exercise-library'
import type { SaveSplitInput } from '@/lib/data/save-split'
import { isHomeEquipment } from '@/lib/exercises/home-workouts'

export type HomeGoal = 'fatLoss' | 'muscleGain' | 'combo' | 'hybrid'

export type HomeProgramMove = {
  id: string
  sets: number
  reps: string
}

export type HomeProgramDay = {
  name: string
  subtitle: string
  moves: HomeProgramMove[]
}

export type HomeProgramTemplate = {
  slug: string
  goal: HomeGoal
  daysPerWeek: number
  days: HomeProgramDay[]
}

export type ResolvedHomeMove = {
  exercise: LibraryExercise
  sets: number
  reps: string
}

export type ResolvedHomeDay = {
  name: string
  subtitle: string
  exercises: ResolvedHomeMove[]
}

export type ResolvedHomeProgram = {
  slug: string
  goal: HomeGoal
  daysPerWeek: number
  days: ResolvedHomeDay[]
}

/** Catalog IDs only — same 1,324-exercise file as the rest of the app. */
export const HOME_PROGRAMS: HomeProgramTemplate[] = [
  {
    slug: 'home-fat-loss',
    goal: 'fatLoss',
    daysPerWeek: 4,
    days: [
      {
        name: 'Full Body Circuit',
        subtitle: 'Work capacity · keep rest short',
        moves: [
          { id: '1160', sets: 3, reps: '8–10' },
          { id: '1685', sets: 3, reps: '12–15' },
          { id: '0662', sets: 3, reps: '10–15' },
          { id: '0630', sets: 3, reps: '30–40s' },
          { id: '0003', sets: 3, reps: '20–30' },
          { id: '0464', sets: 3, reps: '30s' },
        ],
      },
      {
        name: 'Strength + Burn',
        subtitle: 'Goblet pattern + posterior chain',
        moves: [
          { id: '1760', sets: 3, reps: '10–12' },
          { id: '0662', sets: 3, reps: '8–12' },
          { id: '0499', sets: 3, reps: '8–12' },
          { id: '0336', sets: 3, reps: '10 / leg' },
          { id: '0514', sets: 3, reps: '10–12' },
          { id: '0687', sets: 3, reps: '16–20' },
        ],
      },
      {
        name: 'Conditioning',
        subtitle: 'Heart rate · athletic finishers',
        moves: [
          { id: '3360', sets: 3, reps: '30–40s' },
          { id: '0514', sets: 3, reps: '10–12' },
          { id: '0630', sets: 3, reps: '30–40s' },
          { id: '1160', sets: 3, reps: '8–10' },
          { id: '0003', sets: 3, reps: '20–30' },
          { id: '3013', sets: 3, reps: '12–15' },
        ],
      },
      {
        name: 'Posterior + Core',
        subtitle: 'Hinge, glutes, midline',
        moves: [
          { id: '1459', sets: 3, reps: '10–12' },
          { id: '3013', sets: 3, reps: '12–15' },
          { id: '0499', sets: 3, reps: '8–12' },
          { id: '1373', sets: 3, reps: '12–15' },
          { id: '0687', sets: 3, reps: '16–20' },
          { id: '0464', sets: 3, reps: '30s' },
        ],
      },
    ],
  },
  {
    slug: 'home-muscle-gain',
    goal: 'muscleGain',
    daysPerWeek: 4,
    days: [
      {
        name: 'Push',
        subtitle: 'Chest · shoulders · triceps',
        moves: [
          { id: '0289', sets: 4, reps: '8–10' },
          { id: '0405', sets: 3, reps: '8–10' },
          { id: '0662', sets: 3, reps: '10–15' },
          { id: '0308', sets: 3, reps: '12–15' },
          { id: '0334', sets: 3, reps: '12–15' },
          { id: '0333', sets: 3, reps: '12–15' },
        ],
      },
      {
        name: 'Pull',
        subtitle: 'Back · rear delts · biceps',
        moves: [
          { id: '0652', sets: 4, reps: '6–10' },
          { id: '0293', sets: 4, reps: '8–10' },
          { id: '0499', sets: 3, reps: '8–12' },
          { id: '0334', sets: 3, reps: '12–15' },
          { id: '0312', sets: 3, reps: '10–12' },
        ],
      },
      {
        name: 'Legs',
        subtitle: 'Quads · hamstrings · glutes',
        moves: [
          { id: '1760', sets: 4, reps: '8–10' },
          { id: '1459', sets: 3, reps: '8–10' },
          { id: '0336', sets: 3, reps: '10 / leg' },
          { id: '2368', sets: 3, reps: '10 / leg' },
          { id: '3013', sets: 3, reps: '12–15' },
          { id: '1373', sets: 3, reps: '12–15' },
        ],
      },
      {
        name: 'Upper Pump',
        subtitle: 'Hypertrophy accessories',
        moves: [
          { id: '0289', sets: 3, reps: '10–12' },
          { id: '0293', sets: 3, reps: '10–12' },
          { id: '0405', sets: 3, reps: '10–12' },
          { id: '1399', sets: 3, reps: '10–15' },
          { id: '0312', sets: 3, reps: '10–12' },
          { id: '0333', sets: 3, reps: '12–15' },
        ],
      },
    ],
  },
  {
    slug: 'home-combo',
    goal: 'combo',
    daysPerWeek: 4,
    days: [
      {
        name: 'Upper Strength',
        subtitle: 'Heavier compounds, lower reps',
        moves: [
          { id: '0289', sets: 4, reps: '6–8' },
          { id: '0293', sets: 4, reps: '6–8' },
          { id: '0405', sets: 3, reps: '6–8' },
          { id: '0652', sets: 3, reps: '6–10' },
          { id: '0312', sets: 2, reps: '10–12' },
        ],
      },
      {
        name: 'Lower Strength',
        subtitle: 'Squat and hinge priority',
        moves: [
          { id: '1760', sets: 4, reps: '6–8' },
          { id: '1459', sets: 3, reps: '8' },
          { id: '0300', sets: 3, reps: '8' },
          { id: '0336', sets: 3, reps: '8 / leg' },
          { id: '1373', sets: 3, reps: '12–15' },
        ],
      },
      {
        name: 'Upper Hypertrophy',
        subtitle: 'Volume + a short finisher',
        moves: [
          { id: '0662', sets: 3, reps: '10–15' },
          { id: '0499', sets: 3, reps: '10–12' },
          { id: '0308', sets: 3, reps: '12–15' },
          { id: '0334', sets: 3, reps: '12–15' },
          { id: '1399', sets: 3, reps: '10–15' },
          { id: '0003', sets: 2, reps: '20–30' },
        ],
      },
      {
        name: 'Lower + Conditioning',
        subtitle: 'Legs then metabolic work',
        moves: [
          { id: '2368', sets: 3, reps: '10 / leg' },
          { id: '3013', sets: 3, reps: '12–15' },
          { id: '0514', sets: 3, reps: '10–12' },
          { id: '0630', sets: 3, reps: '30s' },
          { id: '1160', sets: 2, reps: '8–10' },
          { id: '0464', sets: 3, reps: '30s' },
        ],
      },
    ],
  },
  {
    slug: 'home-hybrid',
    goal: 'hybrid',
    daysPerWeek: 5,
    days: [
      {
        name: 'Lower Power',
        subtitle: 'Strength for athletes',
        moves: [
          { id: '1760', sets: 4, reps: '6–8' },
          { id: '1459', sets: 3, reps: '8' },
          { id: '2368', sets: 3, reps: '8 / leg' },
          { id: '0514', sets: 3, reps: '6–8' },
          { id: '1373', sets: 3, reps: '10–12' },
        ],
      },
      {
        name: 'Upper Push',
        subtitle: 'Pressing + stability',
        moves: [
          { id: '0289', sets: 4, reps: '6–8' },
          { id: '0405', sets: 3, reps: '8' },
          { id: '0662', sets: 3, reps: '8–12' },
          { id: '0334', sets: 3, reps: '12–15' },
          { id: '0333', sets: 2, reps: '12' },
        ],
      },
      {
        name: 'Engine Day',
        subtitle: 'Kettlebell + bodyweight density',
        moves: [
          { id: '0549', sets: 4, reps: '12–15' },
          { id: '0550', sets: 3, reps: '8–10' },
          { id: '1160', sets: 3, reps: '8–10' },
          { id: '3360', sets: 3, reps: '30s' },
          { id: '0630', sets: 3, reps: '30s' },
        ],
      },
      {
        name: 'Pull + Hinge',
        subtitle: 'Posterior chain and grip',
        moves: [
          { id: '0652', sets: 4, reps: '5–8' },
          { id: '0293', sets: 4, reps: '6–8' },
          { id: '0499', sets: 3, reps: '8–10' },
          { id: '0300', sets: 3, reps: '8' },
          { id: '0312', sets: 3, reps: '8–10' },
        ],
      },
      {
        name: 'Athletic Core',
        subtitle: 'Midline, rotation, odd positions',
        moves: [
          { id: '0464', sets: 3, reps: '30–40s' },
          { id: '0687', sets: 3, reps: '16–20' },
          { id: '3013', sets: 3, reps: '12–15' },
          { id: '0003', sets: 3, reps: '20–30' },
          { id: '1399', sets: 3, reps: '10–12' },
        ],
      },
    ],
  },
]

export const HOME_GOALS: HomeGoal[] = [
  'fatLoss',
  'muscleGain',
  'combo',
  'hybrid',
]

export function resolveHomePrograms(
  library: LibraryExercise[],
): ResolvedHomeProgram[] {
  const byId = new Map(library.map((exercise) => [exercise.id, exercise]))
  return HOME_PROGRAMS.map((template) => ({
    slug: template.slug,
    goal: template.goal,
    daysPerWeek: template.daysPerWeek,
    days: template.days.map((day) => ({
      name: day.name,
      subtitle: day.subtitle,
      exercises: day.moves
        .map((move) => {
          const exercise = byId.get(move.id)
          if (!exercise || !isHomeEquipment(exercise.equipment)) return null
          return { exercise, sets: move.sets, reps: move.reps }
        })
        .filter((row): row is ResolvedHomeMove => Boolean(row)),
    })).filter((day) => day.exercises.length > 0),
  })).filter((program) => program.days.length > 0)
}

export function homeProgramToSavePayload(
  program: ResolvedHomeProgram,
  labels: { name: string; description: string; category: string },
): SaveSplitInput {
  return {
    name: labels.name,
    description: labels.description,
    category: labels.category,
    daysPerWeek: program.daysPerWeek,
    days: program.days.map((day) => ({
      name: day.name,
      subtitle: day.subtitle,
      exercises: day.exercises.map((entry) => ({
        libraryId: entry.exercise.legacySlug || entry.exercise.id,
        name: entry.exercise.name,
        muscles: entry.exercise.muscles,
        image: entry.exercise.image,
        sets: entry.sets,
        reps: entry.reps,
        category: entry.exercise.category,
        equipment: entry.exercise.equipment,
      })),
    })),
  }
}
