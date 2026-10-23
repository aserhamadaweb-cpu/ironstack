import { loadExerciseCatalog } from '@/lib/exercises/catalog'
import type { Exercise } from '@/lib/exercises/types'
import type {
  RecommendedDay,
  RecommendedExercise,
  SplitRecommendation,
  SplitTemplateId,
} from './types'

type CuratedSlot = {
  /** Catalog source id from data/exercises-dataset/exercises.json */
  catalogId: string
  /** Friendly display name for the UI */
  name: string
  sets: number
  reps: string
}

type CuratedDay = {
  name: string
  subtitle: string
  muscleFocus: string[]
  exercises: CuratedSlot[]
}

type CuratedProgram = {
  id: string
  templateId: SplitTemplateId
  name: string
  typeLabel: string
  daysPerWeek: number
  rationale: string
  score: number
  days: CuratedDay[]
}

/**
 * Preferred catalog ids for each movement. When an exact match is missing from
 * the dataset, we use the closest equivalent already in the file.
 */
const EX = {
  barbellBench: '0025',
  inclineDbPress: '0314',
  cableFly: '0188',
  seatedDbShoulderPress: '0405',
  cableLateralRaise: '0178',
  ropePushdown: '0200',
  overheadCableTri: '0194',
  weightedPullup: '0841',
  /** Closest to chest-supported row */
  chestSupportedRow: '0327',
  singleArmCableRow: '0189',
  /** Closest to reverse pec deck */
  reversePecDeck: '0602',
  inclineDbCurl: '0318',
  hammerCurl: '0313',
  /** High-bar squat ≈ barbell full squat */
  highBarSquat: '0043',
  backSquat: '0043',
  legPress: '0739',
  rdl: '0085',
  seatedLegCurl: '0599',
  legExtension: '0585',
  standingCalf: '1372',
  cableCrunch: '0226',
  inclineSmithPress: '0757',
  machineChestPress: '0577',
  /** Closest to pec deck */
  pecDeck: '0596',
  machineShoulderPress: '0603',
  closeGripBench: '0030',
  /** Neutral-grip lat pulldown ≈ V-bar pulldown */
  neutralLatPulldown: '2616',
  oneArmLatPulldown: '3563',
  seatedCableRow: '0180',
  straightArmPulldown: '0238',
  preacherCurl: '0070',
  cableCurl: '0868',
  lyingLegCurl: '0586',
  /** Closest to Bulgarian split squat */
  bulgarianSplitSquat: '0099',
  /** Closest to barbell hip thrust */
  hipThrust: '1409',
  seatedCalf: '0088',
  hangingLegRaise: '0472',
  barbellCurl: '0031',
  barbellRow: '0027',
  barbellShrug: '0095',
  hackSquat: '0743',
  machineLateralRaise: '0584',
  pullup: '0652',
} as const

function slot(
  catalogId: string,
  name: string,
  sets: number,
  reps: string,
): CuratedSlot {
  return { catalogId, name, sets, reps }
}

const CURATED_PROGRAMS: CuratedProgram[] = [
  {
    id: 'ppl_6',
    templateId: 'ppl_6',
    name: 'Push / Pull / Legs',
    typeLabel: 'PPL 6-day',
    daysPerWeek: 6,
    score: 100,
    rationale:
      'Classic 6-day PPL with A/B rotation — high frequency on every muscle without burying you in junk volume.',
    days: [
      {
        name: 'Push A',
        subtitle: 'Chest · shoulders · triceps',
        muscleFocus: ['Chest', 'Shoulders', 'Triceps'],
        exercises: [
          slot(EX.barbellBench, 'Barbell bench press', 3, '5–8'),
          slot(EX.inclineDbPress, 'Incline dumbbell press', 3, '8–12'),
          slot(EX.cableFly, 'Cable fly', 2, '12–15'),
          slot(EX.seatedDbShoulderPress, 'Seated dumbbell shoulder press', 2, '8–12'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 3, '12–20'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 3, '10–15'),
          slot(EX.overheadCableTri, 'Overhead cable triceps extension', 2, '10–15'),
        ],
      },
      {
        name: 'Pull A',
        subtitle: 'Back · rear delts · biceps',
        muscleFocus: ['Back', 'Shoulders', 'Biceps'],
        exercises: [
          slot(EX.weightedPullup, 'Weighted pull-up', 3, '6–10'),
          slot(EX.chestSupportedRow, 'Chest-supported row', 3, '8–12'),
          slot(EX.singleArmCableRow, 'Single-arm cable row', 2, '10–15'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.inclineDbCurl, 'Incline dumbbell curl', 3, '8–12'),
          slot(EX.hammerCurl, 'Hammer curl', 2, '10–15'),
        ],
      },
      {
        name: 'Legs A',
        subtitle: 'Quads · hamstrings · calves · core',
        muscleFocus: ['Quads', 'Hamstrings', 'Calves', 'Core'],
        exercises: [
          slot(EX.highBarSquat, 'High-bar squat', 3, '6–10'),
          slot(EX.legPress, 'Leg press', 3, '10–15'),
          slot(EX.rdl, 'Romanian deadlift', 3, '6–10'),
          slot(EX.seatedLegCurl, 'Seated leg curl', 2, '10–15'),
          slot(EX.legExtension, 'Leg extension', 2, '12–20'),
          slot(EX.standingCalf, 'Standing calf raise', 4, '8–15'),
          slot(EX.cableCrunch, 'Cable crunch', 3, '10–15'),
        ],
      },
      {
        name: 'Push B',
        subtitle: 'Incline focus · machines · triceps',
        muscleFocus: ['Chest', 'Shoulders', 'Triceps'],
        exercises: [
          slot(EX.inclineSmithPress, 'Incline Smith-machine press', 3, '6–10'),
          slot(EX.machineChestPress, 'Machine chest press', 2, '8–12'),
          slot(EX.pecDeck, 'Pec deck', 2, '12–20'),
          slot(EX.machineShoulderPress, 'Machine shoulder press', 3, '8–12'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 4, '12–20'),
          slot(EX.closeGripBench, 'Close-grip bench press', 2, '6–10'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 2, '10–15'),
        ],
      },
      {
        name: 'Pull B',
        subtitle: 'Pulldowns · rows · biceps',
        muscleFocus: ['Back', 'Shoulders', 'Biceps'],
        exercises: [
          slot(EX.neutralLatPulldown, 'Neutral-grip lat pulldown', 3, '8–12'),
          slot(EX.oneArmLatPulldown, 'One-arm lat pulldown', 2, '10–15'),
          slot(EX.seatedCableRow, 'Seated cable row', 3, '8–12'),
          slot(EX.straightArmPulldown, 'Straight-arm cable pulldown', 2, '12–15'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.preacherCurl, 'Preacher curl', 3, '8–12'),
          slot(EX.cableCurl, 'Cable curl', 2, '12–15'),
        ],
      },
      {
        name: 'Legs B',
        subtitle: 'Hinge · single-leg · glutes · core',
        muscleFocus: ['Hamstrings', 'Glutes', 'Quads', 'Core'],
        exercises: [
          slot(EX.rdl, 'Romanian deadlift', 3, '6–10'),
          slot(EX.bulgarianSplitSquat, 'Bulgarian split squat', 3, '8–12 each leg'),
          slot(EX.hipThrust, 'Barbell hip thrust', 3, '8–12'),
          slot(EX.lyingLegCurl, 'Lying leg curl', 3, '10–15'),
          slot(EX.legExtension, 'Leg extension', 2, '12–20'),
          slot(EX.seatedCalf, 'Seated calf raise', 4, '10–20'),
          slot(EX.hangingLegRaise, 'Hanging leg raise', 3, '8–15'),
        ],
      },
    ],
  },
  {
    id: 'arnold',
    templateId: 'arnold',
    name: 'Arnold Split',
    typeLabel: 'Arnold 6-day',
    daysPerWeek: 6,
    score: 95,
    rationale:
      'Arnold’s classic chest/back, shoulders/arms, and legs rotation — serious volume for intermediate and advanced lifters.',
    days: [
      {
        name: 'Chest & Back',
        subtitle: 'Day 1 · horizontal push + pull',
        muscleFocus: ['Chest', 'Back'],
        exercises: [
          slot(EX.barbellBench, 'Barbell bench press', 4, '6–10'),
          slot(EX.inclineDbPress, 'Incline dumbbell press', 3, '8–12'),
          slot(EX.cableFly, 'Cable fly', 3, '12–15'),
          slot(EX.weightedPullup, 'Weighted pull-up', 4, '6–10'),
          slot(EX.chestSupportedRow, 'Chest-supported row', 3, '8–12'),
          slot(EX.straightArmPulldown, 'Straight-arm cable pulldown', 3, '12–15'),
        ],
      },
      {
        name: 'Shoulders & Arms',
        subtitle: 'Day 2 · delts · biceps · triceps',
        muscleFocus: ['Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          slot(EX.seatedDbShoulderPress, 'Seated dumbbell shoulder press', 3, '6–10'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 4, '12–20'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.barbellCurl, 'Barbell curl', 3, '8–12'),
          slot(EX.inclineDbCurl, 'Incline dumbbell curl', 3, '10–15'),
          slot(EX.closeGripBench, 'Close-grip bench press', 3, '6–10'),
          slot(EX.overheadCableTri, 'Overhead cable triceps extension', 3, '10–15'),
        ],
      },
      {
        name: 'Legs',
        subtitle: 'Day 3 · squat · hinge · calves',
        muscleFocus: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
        exercises: [
          slot(EX.highBarSquat, 'High-bar squat', 4, '6–10'),
          slot(EX.rdl, 'Romanian deadlift', 3, '6–10'),
          slot(EX.legPress, 'Leg press', 3, '10–15'),
          slot(EX.seatedLegCurl, 'Seated leg curl', 3, '10–15'),
          slot(EX.legExtension, 'Leg extension', 2, '12–20'),
          slot(EX.standingCalf, 'Standing calf raise', 4, '8–15'),
          slot(EX.cableCrunch, 'Cable crunch', 3, '10–15'),
        ],
      },
      {
        name: 'Chest & Back',
        subtitle: 'Day 4 · machine / incline focus',
        muscleFocus: ['Chest', 'Back'],
        exercises: [
          slot(EX.inclineSmithPress, 'Incline Smith-machine press', 4, '6–10'),
          slot(EX.machineChestPress, 'Machine chest press', 3, '8–12'),
          slot(EX.pecDeck, 'Pec deck', 3, '12–20'),
          slot(EX.neutralLatPulldown, 'Neutral-grip lat pulldown', 4, '8–12'),
          slot(EX.seatedCableRow, 'Seated cable row', 3, '8–12'),
          slot(EX.singleArmCableRow, 'One-arm cable row', 3, '10–15'),
        ],
      },
      {
        name: 'Shoulders & Arms',
        subtitle: 'Day 5 · machine delts · arms',
        muscleFocus: ['Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          slot(EX.machineShoulderPress, 'Machine shoulder press', 3, '8–12'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 4, '12–20'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.preacherCurl, 'Preacher curl', 3, '8–12'),
          slot(EX.hammerCurl, 'Hammer curl', 3, '10–15'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 3, '10–15'),
          slot(EX.overheadCableTri, 'Overhead cable triceps extension', 3, '10–15'),
        ],
      },
      {
        name: 'Legs',
        subtitle: 'Day 6 · hinge · single-leg · glutes',
        muscleFocus: ['Hamstrings', 'Glutes', 'Quads', 'Core'],
        exercises: [
          slot(EX.rdl, 'Romanian deadlift', 3, '6–10'),
          slot(EX.bulgarianSplitSquat, 'Bulgarian split squat', 3, '8–12 each leg'),
          slot(EX.hipThrust, 'Barbell hip thrust', 3, '8–12'),
          slot(EX.lyingLegCurl, 'Lying leg curl', 3, '10–15'),
          slot(EX.legExtension, 'Leg extension', 2, '12–20'),
          slot(EX.seatedCalf, 'Seated calf raise', 4, '10–20'),
          slot(EX.hangingLegRaise, 'Hanging leg raise', 3, '8–15'),
        ],
      },
    ],
  },
  {
    id: 'fbeod',
    templateId: 'fbeod',
    name: 'Full Body EoD',
    typeLabel: 'Full Body A/B',
    daysPerWeek: 3,
    score: 90,
    rationale:
      'Two alternating full-body days — train every other day, hit every pattern, and recover hard between sessions.',
    days: [
      {
        name: 'Full Body A',
        subtitle: 'Squat · bench · pull-up · hinge',
        muscleFocus: ['Quads', 'Chest', 'Back', 'Hamstrings'],
        exercises: [
          slot(EX.backSquat, 'Barbell back squat', 3, '6–10'),
          slot(EX.barbellBench, 'Barbell bench press', 3, '6–10'),
          slot(EX.weightedPullup, 'Weighted pull-up', 3, '6–10'),
          slot(EX.rdl, 'Romanian deadlift', 3, '8–12'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 3, '12–20'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 2, '10–15'),
          slot(EX.inclineDbCurl, 'Incline dumbbell curl', 2, '10–15'),
          slot(EX.standingCalf, 'Standing calf raise', 3, '10–15'),
        ],
      },
      {
        name: 'Full Body B',
        subtitle: 'Single-leg · incline · row · hip thrust',
        muscleFocus: ['Glutes', 'Chest', 'Back', 'Shoulders'],
        exercises: [
          slot(EX.bulgarianSplitSquat, 'Bulgarian split squat', 3, '8–12 each leg'),
          slot(EX.inclineDbPress, 'Incline dumbbell press', 3, '8–12'),
          slot(EX.chestSupportedRow, 'Chest-supported row', 3, '8–12'),
          slot(EX.hipThrust, 'Barbell hip thrust', 3, '8–12'),
          slot(EX.seatedDbShoulderPress, 'Seated dumbbell shoulder press', 2, '8–12'),
          slot(EX.overheadCableTri, 'Overhead cable triceps extension', 2, '10–15'),
          slot(EX.preacherCurl, 'Preacher curl', 2, '10–15'),
          slot(EX.seatedCalf, 'Seated calf raise', 3, '10–20'),
        ],
      },
    ],
  },
  {
    id: 'pro_split',
    templateId: 'pro_split',
    name: 'Pro Split',
    typeLabel: 'Bro Split 6-day',
    daysPerWeek: 6,
    score: 85,
    rationale:
      'One major body part per day with a weak-point finisher day — maximum focus and recovery between sessions.',
    days: [
      {
        name: 'Chest',
        subtitle: 'Day 1 · presses and flys',
        muscleFocus: ['Chest'],
        exercises: [
          slot(EX.barbellBench, 'Barbell bench press', 4, '6–10'),
          slot(EX.inclineDbPress, 'Incline dumbbell press', 4, '8–12'),
          slot(EX.machineChestPress, 'Machine chest press', 3, '10–15'),
          slot(EX.cableFly, 'Cable fly', 3, '12–20'),
        ],
      },
      {
        name: 'Back',
        subtitle: 'Day 2 · vertical + horizontal pull',
        muscleFocus: ['Back'],
        exercises: [
          slot(EX.weightedPullup, 'Weighted pull-up', 4, '6–10'),
          slot(EX.barbellRow, 'Barbell row', 4, '6–10'),
          slot(EX.neutralLatPulldown, 'Neutral-grip lat pulldown', 3, '8–12'),
          slot(EX.seatedCableRow, 'Seated cable row', 3, '10–15'),
          slot(EX.straightArmPulldown, 'Straight-arm cable pulldown', 2, '12–20'),
        ],
      },
      {
        name: 'Legs',
        subtitle: 'Day 3 · squat · hinge · isolation',
        muscleFocus: ['Quads', 'Hamstrings', 'Calves'],
        exercises: [
          slot(EX.backSquat, 'Barbell back squat', 4, '6–10'),
          slot(EX.rdl, 'Romanian deadlift', 4, '6–10'),
          slot(EX.legPress, 'Leg press', 3, '10–15'),
          slot(EX.seatedLegCurl, 'Seated leg curl', 3, '10–15'),
          slot(EX.legExtension, 'Leg extension', 3, '12–20'),
          slot(EX.standingCalf, 'Standing calf raise', 4, '10–15'),
        ],
      },
      {
        name: 'Shoulders',
        subtitle: 'Day 4 · press · laterals · traps',
        muscleFocus: ['Shoulders', 'Traps'],
        exercises: [
          slot(EX.seatedDbShoulderPress, 'Seated dumbbell shoulder press', 4, '6–10'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 4, '12–20'),
          slot(EX.machineLateralRaise, 'Machine lateral raise', 3, '12–20'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 4, '12–20'),
          slot(EX.barbellShrug, 'Barbell shrug', 3, '10–15'),
        ],
      },
      {
        name: 'Arms',
        subtitle: 'Day 5 · biceps · triceps',
        muscleFocus: ['Biceps', 'Triceps'],
        exercises: [
          slot(EX.barbellCurl, 'Barbell curl', 4, '8–12'),
          slot(EX.inclineDbCurl, 'Incline dumbbell curl', 3, '10–15'),
          slot(EX.hammerCurl, 'Hammer curl', 3, '10–15'),
          slot(EX.closeGripBench, 'Close-grip bench press', 4, '6–10'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 3, '10–15'),
          slot(EX.overheadCableTri, 'Overhead cable triceps extension', 3, '10–15'),
        ],
      },
      {
        name: 'Weak Points & Abs',
        subtitle: 'Day 6 · extras · calves · core',
        muscleFocus: ['Chest', 'Back', 'Shoulders', 'Core'],
        exercises: [
          slot(EX.machineChestPress, 'Machine chest press', 3, '8–12'),
          slot(EX.neutralLatPulldown, 'Neutral-grip lat pulldown', 3, '8–12'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 4, '12–20'),
          slot(EX.preacherCurl, 'Preacher curl', 3, '10–15'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 3, '10–15'),
          slot(EX.seatedCalf, 'Seated calf raise', 4, '12–20'),
          slot(EX.cableCrunch, 'Cable crunch', 3, '10–15'),
        ],
      },
    ],
  },
  {
    id: 'anterior_posterior',
    templateId: 'anterior_posterior',
    name: 'Anterior / Posterior',
    typeLabel: 'Ant/Post 6-day',
    daysPerWeek: 6,
    score: 80,
    rationale:
      'Alternate front-of-body and back-of-body days (A/B/C) — balanced push/pull frequency with built-in recovery.',
    days: [
      {
        name: 'Anterior A',
        subtitle: 'Squat · bench · press',
        muscleFocus: ['Quads', 'Chest', 'Shoulders', 'Triceps'],
        exercises: [
          slot(EX.backSquat, 'Barbell back squat', 3, '6–10'),
          slot(EX.barbellBench, 'Barbell bench press', 3, '6–10'),
          slot(EX.seatedDbShoulderPress, 'Seated dumbbell shoulder press', 3, '8–12'),
          slot(EX.legExtension, 'Leg extension', 2, '12–20'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 2, '10–15'),
          slot(EX.standingCalf, 'Standing calf raise', 3, '10–15'),
        ],
      },
      {
        name: 'Posterior A',
        subtitle: 'Hinge · pull · rear delts',
        muscleFocus: ['Hamstrings', 'Back', 'Biceps'],
        exercises: [
          slot(EX.rdl, 'Romanian deadlift', 3, '6–10'),
          slot(EX.weightedPullup, 'Weighted pull-up', 3, '6–10'),
          slot(EX.chestSupportedRow, 'Chest-supported row', 3, '8–12'),
          slot(EX.seatedLegCurl, 'Seated leg curl', 2, '10–15'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.inclineDbCurl, 'Incline dumbbell curl', 2, '10–15'),
        ],
      },
      {
        name: 'Anterior B',
        subtitle: 'Press · laterals · single-leg',
        muscleFocus: ['Quads', 'Chest', 'Shoulders', 'Triceps'],
        exercises: [
          slot(EX.legPress, 'Leg press', 3, '10–15'),
          slot(EX.inclineDbPress, 'Incline dumbbell press', 3, '8–12'),
          slot(EX.cableLateralRaise, 'Cable lateral raise', 3, '12–20'),
          slot(EX.bulgarianSplitSquat, 'Bulgarian split squat', 2, '8–12 each leg'),
          slot(EX.overheadCableTri, 'Overhead cable triceps extension', 2, '10–15'),
          slot(EX.seatedCalf, 'Seated calf raise', 3, '12–20'),
        ],
      },
      {
        name: 'Posterior B',
        subtitle: 'Glutes · pulldown · row',
        muscleFocus: ['Glutes', 'Back', 'Hamstrings', 'Biceps'],
        exercises: [
          slot(EX.hipThrust, 'Barbell hip thrust', 3, '8–12'),
          slot(EX.neutralLatPulldown, 'Neutral-grip lat pulldown', 3, '8–12'),
          slot(EX.seatedCableRow, 'Seated cable row', 3, '8–12'),
          slot(EX.lyingLegCurl, 'Lying leg curl', 2, '10–15'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.preacherCurl, 'Preacher curl', 2, '10–15'),
        ],
      },
      {
        name: 'Anterior C',
        subtitle: 'Machines · press · core',
        muscleFocus: ['Quads', 'Chest', 'Shoulders', 'Core'],
        exercises: [
          slot(EX.hackSquat, 'Hack squat', 3, '8–12'),
          slot(EX.machineChestPress, 'Machine chest press', 3, '8–12'),
          slot(EX.machineShoulderPress, 'Machine shoulder press', 3, '8–12'),
          slot(EX.legExtension, 'Leg extension', 2, '12–20'),
          slot(EX.ropePushdown, 'Rope triceps pressdown', 2, '10–15'),
          slot(EX.cableCrunch, 'Cable crunch', 3, '10–15'),
        ],
      },
      {
        name: 'Posterior C',
        subtitle: 'Hinge · row · arms',
        muscleFocus: ['Hamstrings', 'Back', 'Biceps'],
        exercises: [
          slot(EX.rdl, 'Romanian deadlift', 3, '8–12'),
          slot(EX.singleArmCableRow, 'One-arm cable row', 3, '10–15'),
          slot(EX.straightArmPulldown, 'Straight-arm cable pulldown', 3, '12–15'),
          slot(EX.seatedLegCurl, 'Seated leg curl', 2, '10–15'),
          slot(EX.reversePecDeck, 'Reverse pec deck', 3, '12–20'),
          slot(EX.hammerCurl, 'Hammer curl', 2, '10–15'),
        ],
      },
    ],
  },
]

function resolveExercise(
  catalogById: Map<string, Exercise>,
  slot: CuratedSlot,
): RecommendedExercise | null {
  const exercise = catalogById.get(slot.catalogId)
  if (!exercise) return null
  return {
    libraryId: exercise.sourceId,
    name: slot.name,
    muscles: [
      exercise.muscleGroup,
      ...exercise.secondaryMuscles.slice(0, 2),
    ].filter(Boolean),
    image: exercise.image || exercise.gifUrl || null,
    category: exercise.category,
    sets: slot.sets,
    reps: slot.reps,
  }
}

function materializeProgram(
  program: CuratedProgram,
  catalogById: Map<string, Exercise>,
): SplitRecommendation | null {
  const schedule: RecommendedDay[] = []
  for (const day of program.days) {
    const exercises: RecommendedExercise[] = []
    for (const slotDef of day.exercises) {
      const resolved = resolveExercise(catalogById, slotDef)
      if (resolved) exercises.push(resolved)
    }
    if (exercises.length === 0) continue
    schedule.push({
      name: day.name,
      subtitle: day.subtitle,
      muscleFocus: day.muscleFocus,
      exercises,
    })
  }
  if (schedule.length === 0) return null
  return {
    id: program.id,
    templateId: program.templateId,
    name: program.name,
    typeLabel: program.typeLabel,
    daysPerWeek: program.daysPerWeek,
    rationale: program.rationale,
    score: program.score,
    schedule,
  }
}

/** Fixed recommended programs — replaces dynamic template scoring. */
export function buildCuratedRecommendations(): SplitRecommendation[] {
  const catalog = loadExerciseCatalog()
  const byId = new Map(catalog.map((exercise) => [exercise.sourceId, exercise]))
  const out: SplitRecommendation[] = []
  for (const program of CURATED_PROGRAMS) {
    const rec = materializeProgram(program, byId)
    if (rec) out.push(rec)
  }
  return out
}

export function getCuratedRecommendationById(
  id: string,
): SplitRecommendation | null {
  const needle = id.trim()
  if (!needle) return null
  return (
    buildCuratedRecommendations().find(
      (rec) => rec.id === needle || rec.templateId === needle,
    ) ?? null
  )
}
