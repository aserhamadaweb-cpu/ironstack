export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core'
  | 'Traps'

export type Exercise = {
  id: string
  name: string
  sets: number
  reps: string
  muscle: MuscleGroup
  /** lift_types.category — e.g. compound, accessory, cardio. */
  category?: string
  /** Catalog equipment is body weight — session logs reps only. */
  bodyweight?: boolean
  /** Real photo URL from lift_types.image_url when available. */
  image?: string
  /** Looping catalog GIF so the athlete can follow the movement. */
  gif?: string
  /** Live DB lift_types.id — required for session logging against Supabase. */
  liftTypeId?: string
  /** Catalog source id (e.g. "0025") for exercise detail / GIF lookup. */
  catalogExerciseId?: string
}

export type SplitDay = {
  id: string
  /** Short focus name, e.g. "Push". */
  focus: string
  /** Supporting line under the day heading. */
  note: string
  exercises: Exercise[]
}

export type SplitDetail = {
  slug: string
  name: string
  description: string
  tag: string
  daysPerWeek: number
  recommended: boolean
  summary: string
  schedule: SplitDay[]
  /** Owner user id when this is a custom split. */
  userId?: string | null
  isShared?: boolean
  isSystem?: boolean
}

export const SPLIT_DETAILS: SplitDetail[] = [
  {
    slug: 'ppl',
    name: 'Push / Pull / Legs',
    description: '6 days/week · Ideal for intermediate lifters',
    tag: 'Popular',
    daysPerWeek: 6,
    recommended: true,
    summary:
      'Three training days run twice per week. Push covers chest, shoulders and triceps, pull hits back and biceps, and legs takes the lower body — high frequency with plenty of room for volume.',
    schedule: [
      {
        id: 'push',
        focus: 'Push',
        note: 'Chest · Shoulders · Triceps',
        exercises: [
          { id: 'ppl-p1', name: 'Barbell Bench Press', sets: 4, reps: '6–8', muscle: 'Chest' },
          { id: 'ppl-p2', name: 'Seated Dumbbell Shoulder Press', sets: 3, reps: '8–10', muscle: 'Shoulders' },
          { id: 'ppl-p3', name: 'Incline Dumbbell Press', sets: 3, reps: '10–12', muscle: 'Chest' },
          { id: 'ppl-p4', name: 'Cable Lateral Raise', sets: 3, reps: '12–15', muscle: 'Shoulders' },
          { id: 'ppl-p5', name: 'Overhead Rope Triceps Extension', sets: 3, reps: '10–12', muscle: 'Triceps' },
          { id: 'ppl-p6', name: 'Triceps Pushdown', sets: 3, reps: '12–15', muscle: 'Triceps' },
        ],
      },
      {
        id: 'pull',
        focus: 'Pull',
        note: 'Back · Rear Delts · Biceps',
        exercises: [
          { id: 'ppl-l1', name: 'Deadlift', sets: 4, reps: '4–6', muscle: 'Back' },
          { id: 'ppl-l2', name: 'Pull-Up', sets: 4, reps: '6–10', muscle: 'Back' },
          { id: 'ppl-l3', name: 'Chest-Supported Row', sets: 3, reps: '8–10', muscle: 'Back' },
          { id: 'ppl-l4', name: 'Face Pull', sets: 3, reps: '15–20', muscle: 'Shoulders' },
          { id: 'ppl-l5', name: 'Barbell Curl', sets: 3, reps: '8–10', muscle: 'Biceps' },
          { id: 'ppl-l6', name: 'Incline Dumbbell Curl', sets: 3, reps: '12–15', muscle: 'Biceps' },
        ],
      },
      {
        id: 'legs',
        focus: 'Legs',
        note: 'Quads · Hamstrings · Calves',
        exercises: [
          { id: 'ppl-g1', name: 'Back Squat', sets: 4, reps: '5–8', muscle: 'Quads' },
          { id: 'ppl-g2', name: 'Romanian Deadlift', sets: 3, reps: '8–10', muscle: 'Hamstrings' },
          { id: 'ppl-g3', name: 'Leg Press', sets: 3, reps: '10–12', muscle: 'Quads' },
          { id: 'ppl-g4', name: 'Seated Leg Curl', sets: 3, reps: '12–15', muscle: 'Hamstrings' },
          { id: 'ppl-g5', name: 'Standing Calf Raise', sets: 4, reps: '12–15', muscle: 'Calves' },
          { id: 'ppl-g6', name: 'Hanging Leg Raise', sets: 3, reps: '12–15', muscle: 'Core' },
        ],
      },
    ],
  },
  {
    slug: 'ul',
    name: 'Upper / Lower',
    description: '4 days/week · Great balance of recovery & volume',
    tag: 'Balanced',
    daysPerWeek: 4,
    recommended: false,
    summary:
      'Two upper and two lower days per week. The first pass of each leans heavy and strength-focused, the second leans lighter and hypertrophy-focused so joints get a break without losing volume.',
    schedule: [
      {
        id: 'upper-a',
        focus: 'Upper A — Strength',
        note: 'Heavy compounds, lower reps',
        exercises: [
          { id: 'ul-ua1', name: 'Barbell Bench Press', sets: 4, reps: '5', muscle: 'Chest' },
          { id: 'ul-ua2', name: 'Barbell Row', sets: 4, reps: '6–8', muscle: 'Back' },
          { id: 'ul-ua3', name: 'Standing Overhead Press', sets: 3, reps: '6–8', muscle: 'Shoulders' },
          { id: 'ul-ua4', name: 'Lat Pulldown', sets: 3, reps: '10–12', muscle: 'Back' },
          { id: 'ul-ua5', name: 'Dumbbell Lateral Raise', sets: 3, reps: '12–15', muscle: 'Shoulders' },
          { id: 'ul-ua6', name: 'Skull Crusher', sets: 3, reps: '10–12', muscle: 'Triceps' },
          { id: 'ul-ua7', name: 'Hammer Curl', sets: 3, reps: '10–12', muscle: 'Biceps' },
        ],
      },
      {
        id: 'lower-a',
        focus: 'Lower A — Strength',
        note: 'Squat pattern priority',
        exercises: [
          { id: 'ul-la1', name: 'Back Squat', sets: 4, reps: '5', muscle: 'Quads' },
          { id: 'ul-la2', name: 'Romanian Deadlift', sets: 3, reps: '8', muscle: 'Hamstrings' },
          { id: 'ul-la3', name: 'Bulgarian Split Squat', sets: 3, reps: '10', muscle: 'Glutes' },
          { id: 'ul-la4', name: 'Leg Extension', sets: 3, reps: '12–15', muscle: 'Quads' },
          { id: 'ul-la5', name: 'Seated Calf Raise', sets: 4, reps: '15', muscle: 'Calves' },
          { id: 'ul-la6', name: 'Plank', sets: 3, reps: '45 sec', muscle: 'Core' },
        ],
      },
      {
        id: 'upper-b',
        focus: 'Upper B — Hypertrophy',
        note: 'Machines and cables, higher reps',
        exercises: [
          { id: 'ul-ub1', name: 'Incline Dumbbell Press', sets: 4, reps: '8–10', muscle: 'Chest' },
          { id: 'ul-ub2', name: 'Chest-Supported Row', sets: 4, reps: '10–12', muscle: 'Back' },
          { id: 'ul-ub3', name: 'Arnold Press', sets: 3, reps: '10–12', muscle: 'Shoulders' },
          { id: 'ul-ub4', name: 'Cable Fly', sets: 3, reps: '12–15', muscle: 'Chest' },
          { id: 'ul-ub5', name: 'Straight-Arm Pulldown', sets: 3, reps: '12–15', muscle: 'Back' },
          { id: 'ul-ub6', name: 'Cable Curl', sets: 3, reps: '12–15', muscle: 'Biceps' },
          { id: 'ul-ub7', name: 'Rope Pushdown', sets: 3, reps: '12–15', muscle: 'Triceps' },
        ],
      },
      {
        id: 'lower-b',
        focus: 'Lower B — Hypertrophy',
        note: 'Hinge and glute priority',
        exercises: [
          { id: 'ul-lb1', name: 'Front Squat', sets: 3, reps: '8–10', muscle: 'Quads' },
          { id: 'ul-lb2', name: 'Barbell Hip Thrust', sets: 4, reps: '10–12', muscle: 'Glutes' },
          { id: 'ul-lb3', name: 'Walking Lunge', sets: 3, reps: '12 / leg', muscle: 'Glutes' },
          { id: 'ul-lb4', name: 'Lying Leg Curl', sets: 3, reps: '12–15', muscle: 'Hamstrings' },
          { id: 'ul-lb5', name: 'Standing Calf Raise', sets: 4, reps: '15–20', muscle: 'Calves' },
          { id: 'ul-lb6', name: 'Cable Crunch', sets: 3, reps: '15', muscle: 'Core' },
        ],
      },
    ],
  },
  {
    slug: 'fb',
    name: 'Full Body',
    description: '3 days/week · Best for beginners',
    tag: 'Beginner',
    daysPerWeek: 3,
    recommended: false,
    summary:
      'Three sessions a week, each hitting the whole body with one main squat, hinge, push and pull. Low session count and high frequency per movement — the fastest way to learn technique.',
    schedule: [
      {
        id: 'day-a',
        focus: 'Day A',
        note: 'Squat + horizontal press',
        exercises: [
          { id: 'fb-a1', name: 'Back Squat', sets: 3, reps: '5', muscle: 'Quads' },
          { id: 'fb-a2', name: 'Barbell Bench Press', sets: 3, reps: '5', muscle: 'Chest' },
          { id: 'fb-a3', name: 'Barbell Row', sets: 3, reps: '8', muscle: 'Back' },
          { id: 'fb-a4', name: 'Standing Overhead Press', sets: 2, reps: '10', muscle: 'Shoulders' },
          { id: 'fb-a5', name: 'Plank', sets: 3, reps: '40 sec', muscle: 'Core' },
        ],
      },
      {
        id: 'day-b',
        focus: 'Day B',
        note: 'Hinge + vertical press',
        exercises: [
          { id: 'fb-b1', name: 'Deadlift', sets: 3, reps: '5', muscle: 'Back' },
          { id: 'fb-b2', name: 'Standing Overhead Press', sets: 3, reps: '5', muscle: 'Shoulders' },
          { id: 'fb-b3', name: 'Lat Pulldown', sets: 3, reps: '10', muscle: 'Back' },
          { id: 'fb-b4', name: 'Leg Press', sets: 3, reps: '12', muscle: 'Quads' },
          { id: 'fb-b5', name: 'Hanging Leg Raise', sets: 3, reps: '12', muscle: 'Core' },
        ],
      },
      {
        id: 'day-c',
        focus: 'Day C',
        note: 'Volume and accessories',
        exercises: [
          { id: 'fb-c1', name: 'Front Squat', sets: 3, reps: '8', muscle: 'Quads' },
          { id: 'fb-c2', name: 'Incline Dumbbell Press', sets: 3, reps: '10', muscle: 'Chest' },
          { id: 'fb-c3', name: 'Seated Cable Row', sets: 3, reps: '10', muscle: 'Back' },
          { id: 'fb-c4', name: 'Romanian Deadlift', sets: 3, reps: '10', muscle: 'Hamstrings' },
          { id: 'fb-c5', name: 'Dumbbell Curl', sets: 2, reps: '12', muscle: 'Biceps' },
          { id: 'fb-c6', name: 'Standing Calf Raise', sets: 3, reps: '15', muscle: 'Calves' },
        ],
      },
    ],
  },
  {
    slug: 'bro',
    name: 'Bro Split',
    description: '5 days/week · Classic body-part focus',
    tag: 'Classic',
    daysPerWeek: 5,
    recommended: false,
    summary:
      'One body part per day, five days a week. Each muscle gets a full session of dedicated volume and a full week to recover — the classic bodybuilding template.',
    schedule: [
      {
        id: 'chest',
        focus: 'Chest',
        note: 'Press and fly volume',
        exercises: [
          { id: 'bro-c1', name: 'Barbell Bench Press', sets: 4, reps: '8', muscle: 'Chest' },
          { id: 'bro-c2', name: 'Incline Dumbbell Press', sets: 4, reps: '10', muscle: 'Chest' },
          { id: 'bro-c3', name: 'Cable Fly', sets: 3, reps: '12–15', muscle: 'Chest' },
          { id: 'bro-c4', name: 'Chest Dip', sets: 3, reps: '10–12', muscle: 'Chest' },
          { id: 'bro-c5', name: 'Push-Up (Burnout)', sets: 2, reps: '20+', muscle: 'Chest' },
        ],
      },
      {
        id: 'back',
        focus: 'Back',
        note: 'Vertical and horizontal pulling',
        exercises: [
          { id: 'bro-b1', name: 'Deadlift', sets: 4, reps: '6', muscle: 'Back' },
          { id: 'bro-b2', name: 'Pull-Up', sets: 4, reps: '8–10', muscle: 'Back' },
          { id: 'bro-b3', name: 'Barbell Row', sets: 3, reps: '10', muscle: 'Back' },
          { id: 'bro-b4', name: 'Seated Cable Row', sets: 3, reps: '12', muscle: 'Back' },
          { id: 'bro-b5', name: 'Straight-Arm Pulldown', sets: 3, reps: '15', muscle: 'Back' },
        ],
      },
      {
        id: 'shoulders',
        focus: 'Shoulders',
        note: 'All three delt heads plus traps',
        exercises: [
          { id: 'bro-s1', name: 'Standing Overhead Press', sets: 4, reps: '8', muscle: 'Shoulders' },
          { id: 'bro-s2', name: 'Dumbbell Lateral Raise', sets: 4, reps: '12–15', muscle: 'Shoulders' },
          { id: 'bro-s3', name: 'Rear-Delt Fly', sets: 3, reps: '15', muscle: 'Shoulders' },
          { id: 'bro-s4', name: 'Cable Front Raise', sets: 3, reps: '12', muscle: 'Shoulders' },
          { id: 'bro-s5', name: 'Barbell Shrug', sets: 4, reps: '12', muscle: 'Traps' },
        ],
      },
      {
        id: 'arms',
        focus: 'Arms',
        note: 'Biceps and triceps supersets',
        exercises: [
          { id: 'bro-a1', name: 'Barbell Curl', sets: 4, reps: '10', muscle: 'Biceps' },
          { id: 'bro-a2', name: 'Close-Grip Bench Press', sets: 4, reps: '10', muscle: 'Triceps' },
          { id: 'bro-a3', name: 'Incline Dumbbell Curl', sets: 3, reps: '12', muscle: 'Biceps' },
          { id: 'bro-a4', name: 'Overhead Rope Extension', sets: 3, reps: '12', muscle: 'Triceps' },
          { id: 'bro-a5', name: 'Cable Hammer Curl', sets: 3, reps: '15', muscle: 'Biceps' },
          { id: 'bro-a6', name: 'Rope Pushdown', sets: 3, reps: '15', muscle: 'Triceps' },
        ],
      },
      {
        id: 'legs',
        focus: 'Legs',
        note: 'Quads, hamstrings and calves',
        exercises: [
          { id: 'bro-l1', name: 'Back Squat', sets: 4, reps: '8', muscle: 'Quads' },
          { id: 'bro-l2', name: 'Romanian Deadlift', sets: 4, reps: '10', muscle: 'Hamstrings' },
          { id: 'bro-l3', name: 'Leg Press', sets: 3, reps: '12', muscle: 'Quads' },
          { id: 'bro-l4', name: 'Leg Extension', sets: 3, reps: '15', muscle: 'Quads' },
          { id: 'bro-l5', name: 'Lying Leg Curl', sets: 3, reps: '15', muscle: 'Hamstrings' },
          { id: 'bro-l6', name: 'Standing Calf Raise', sets: 4, reps: '20', muscle: 'Calves' },
        ],
      },
    ],
  },
]

export function getSplitBySlug(slug: string) {
  return SPLIT_DETAILS.find((split) => split.slug === slug)
}

export function countExercises(split: SplitDetail) {
  return split.schedule.reduce((total, day) => total + day.exercises.length, 0)
}
