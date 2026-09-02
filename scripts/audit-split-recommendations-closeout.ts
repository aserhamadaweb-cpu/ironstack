/**
 * Close-out audit for senior-mode catalog matching + full 55+ recommendation output
 * + limitation fallback verification.
 *
 *   npx tsx scripts/audit-split-recommendations-closeout.ts
 */

import { loadExerciseCatalog } from '../lib/exercises/catalog'
import { shouldAvoidExercise } from '../lib/split-recommendations/limitations'
import {
  generateFromOnboardingData,
  inputFromOnboarding,
} from '../lib/split-recommendations/generate'
import {
  emptyOnboardingData,
  type OnboardingData,
} from '../lib/onboarding-types'
import type { SplitRecommendation } from '../lib/split-recommendations/types'

const catalog = loadExerciseCatalog()
const allNames = catalog.map((e) => e.name).sort((a, b) => a.localeCompare(b))

function section(title: string) {
  console.log('\n' + '='.repeat(72))
  console.log(title)
  console.log('='.repeat(72))
}

function listMatches(label: string, names: string[]) {
  console.log(`\n${label} (${names.length} exercises)`)
  console.log('-'.repeat(72))
  if (names.length === 0) {
    console.log('  (none)')
    return
  }
  for (const n of names) console.log(`  • ${n}`)
}

function matchesSeniorOnly(pattern: RegExp): string[] {
  return allNames.filter((name) => {
    if (!pattern.test(name)) return false
    return shouldAvoidExercise(name, '', true)
  })
}

function matchesWithLimitation(limitText: string, seniorMode: boolean): string[] {
  return allNames.filter((name) => shouldAvoidExercise(name, limitText, seniorMode))
}

function printRecommendation(rec: SplitRecommendation) {
  console.log(`\n  Template: ${rec.templateId} (${rec.typeLabel})`)
  console.log(`  Score: ${rec.score}%`)
  console.log(`  Rationale: ${rec.rationale}`)
  for (const day of rec.schedule) {
    console.log(`\n  [${day.name}] — ${day.subtitle}`)
    console.log(`  Focus: ${day.muscleFocus.join(', ')}`)
    if (day.exercises.length === 0) {
      console.log('    (no exercises — slot unfilled)')
    }
    for (const ex of day.exercises) {
      const tag = ex.isFinisher ? ' [FINISHER]' : ''
      console.log(`    • ${ex.name} — ${ex.sets}× ${ex.reps}${tag}`)
    }
    if (day.finisherNote) {
      console.log(`    ↳ ${day.finisherNote}`)
    }
  }
}

function profile(overrides: Partial<OnboardingData>): OnboardingData {
  return { ...emptyOnboardingData(), step: 9, ageRange: '55_plus', ...overrides }
}

function anyAvoidedInRec(
  rec: SplitRecommendation,
  limitText: string,
  seniorMode: boolean,
): string[] {
  const hits: string[] = []
  for (const day of rec.schedule) {
    for (const ex of day.exercises) {
      if (shouldAvoidExercise(ex.name, limitText, seniorMode)) {
        hits.push(`${day.name}: ${ex.name}`)
      }
    }
  }
  return hits
}

// ---------------------------------------------------------------------------
// 1. Catalog matching audit
// ---------------------------------------------------------------------------
section('1A. SENIOR-MODE ONLY avoids (empty limitations, seniorMode=true)')

listMatches(
  'Pattern: /jump/i (senior hard-avoid)',
  matchesSeniorOnly(/jump/i),
)
listMatches(
  'Pattern: /plyometric/i (senior hard-avoid)',
  matchesSeniorOnly(/plyometric/i),
)
listMatches(
  'Pattern: /burpee/i (senior hard-avoid)',
  matchesSeniorOnly(/burpee/i),
)
listMatches(
  'Pattern: /box jump/i (senior hard-avoid)',
  matchesSeniorOnly(/box jump/i),
)
listMatches(
  'Pattern: /sprint/i (senior hard-avoid)',
  matchesSeniorOnly(/sprint/i),
)
listMatches(
  'Pattern: /behind the neck/i (senior hard-avoid)',
  matchesSeniorOnly(/behind the neck/i),
)
listMatches(
  'Pattern: /upright row/i (senior hard-avoid)',
  matchesSeniorOnly(/upright row/i),
)

listMatches(
  'Pattern: explosive push-ups (clap/plyo/tap/chest tap/drop push)',
  allNames.filter((name) =>
    shouldAvoidExercise(name, '', true) &&
    /push|clap|plyo|tap|drop/i.test(name),
  ),
)

listMatches(
  'Pattern: high-tempo finishers (mountain climber / jumping jack / back and forth step)',
  allNames.filter((name) =>
    shouldAvoidExercise(name, '', true) &&
    /mountain climber|jumping jack|back and forth step|high knee/i.test(name),
  ),
)

section('1B. LIMITATION KEYWORD avoids (seniorMode=false, keyword active in limit text)')

const limitationCases = [
  { keyword: 'knee', limitText: 'bad knee, avoid deep squats' },
  { keyword: 'shoulder', limitText: 'shoulder impingement' },
  { keyword: 'lower back', limitText: 'lower back disc issue' },
  { keyword: 'wrist', limitText: 'wrist pain, tennis elbow' },
]

for (const { keyword, limitText } of limitationCases) {
  listMatches(
    `All exercises avoided when "${keyword}" is in limitations (${limitText})`,
    matchesWithLimitation(limitText, false),
  )
}

section('1C. SENIOR + limitation combined (seniorMode=true + knee text)')

listMatches(
  'Senior + knee limitation — full avoided set',
  matchesWithLimitation('bad knee', true),
)

// ---------------------------------------------------------------------------
// 2. Four realistic 55+ full recommendation outputs (top pick each)
// ---------------------------------------------------------------------------
const seniorProfiles: Array<{ label: string; data: OnboardingData }> = [
  {
    label: '55+ Profile 1 — beginner / home / bodyweight / general fitness',
    data: profile({
      primaryGoal: 'stay_active',
      fitnessLevel: 'beginner',
      daysPerWeek: 3,
      workoutDuration: '30_45',
      trainingLocation: 'home',
      equipment: ['bodyweight'],
      trainingStyles: ['full_body'],
    }),
  },
  {
    label: '55+ Profile 2 — intermediate / gym / full equipment / build muscle',
    data: profile({
      primaryGoal: 'build_muscle',
      fitnessLevel: 'intermediate',
      daysPerWeek: 4,
      workoutDuration: '45_60',
      trainingLocation: 'gym',
      equipment: ['barbell', 'dumbbells', 'machines', 'pullup_bar', 'bench'],
      trainingStyles: ['upper_lower'],
      favoriteMuscleGroups: ['chest', 'back'],
    }),
  },
  {
    label: '55+ Profile 3 — beginner / gym / limited equipment / lose fat',
    data: profile({
      primaryGoal: 'lose_fat',
      fitnessLevel: 'beginner',
      daysPerWeek: 4,
      workoutDuration: '30_45',
      trainingLocation: 'gym',
      equipment: ['machines', 'dumbbells'],
      trainingStyles: ['full_body'],
      limitations: '',
    }),
  },
  {
    label: '55+ Profile 4 — advanced / home / dumbbells / get stronger',
    data: profile({
      primaryGoal: 'get_stronger',
      secondaryGoals: ['build_muscle'],
      fitnessLevel: 'advanced',
      daysPerWeek: 5,
      workoutDuration: '45_60',
      trainingLocation: 'home',
      equipment: ['dumbbells', 'bench', 'bands'],
      trainingStyles: ['strength', 'upper_lower'],
    }),
  },
]

for (const { label, data } of seniorProfiles) {
  section(`2. FULL OUTPUT — ${label}`)
  const input = inputFromOnboarding(data)
  console.log(
    `\nEffective days: ${input?.daysPerWeek} (stated: ${input?.statedDaysPerWeek}), seniorMode: ${input?.seniorMode}`,
  )
  const recs = generateFromOnboardingData(data)
  const top = recs[0]
  if (!top) {
    console.log('\n  (no recommendations generated)')
    continue
  }
  printRecommendation(top)
}

// ---------------------------------------------------------------------------
// 3. Limitation fallback test — knee + home + bodyweight only
// ---------------------------------------------------------------------------
section('3. LIMITATION FALLBACK TEST — knee + home + bodyweight only')

const kneeProfile = profile({
  primaryGoal: 'build_muscle',
  fitnessLevel: 'beginner',
  daysPerWeek: 3,
  workoutDuration: '30_45',
  trainingLocation: 'home',
  equipment: ['bodyweight'],
  limitations: 'bad knee, avoid deep squats and lunges',
  avoidances: 'jumping',
})

const kneeRecs = generateFromOnboardingData(kneeProfile)
const kneeTop = kneeRecs[0]
const kneeLimitText = 'bad knee, avoid deep squats and lunges jumping'

console.log('\nProfile: beginner, 3d, home, bodyweight only, knee limitation')
if (kneeTop) {
  printRecommendation(kneeTop)
  const violations = anyAvoidedInRec(kneeTop, kneeLimitText, true)
  console.log('\n--- Avoid-pattern violation check ---')
  if (violations.length === 0) {
    console.log('  ✓ No avoided-pattern exercises in output')
  } else {
    console.log('  ✗ VIOLATIONS FOUND:')
    for (const v of violations) console.log(`    • ${v}`)
  }
  const squatLungeJump = kneeTop.schedule.flatMap((d) =>
    d.exercises
      .filter((e) => /squat|lunge|leg press|jump/i.test(e.name))
      .map((e) => `${d.name}: ${e.name}`),
  )
  console.log('\n--- Explicit squat/lunge/leg press/jump name check ---')
  if (squatLungeJump.length === 0) {
    console.log('  ✓ None of squat/lunge/leg press/jump appear in output')
  } else {
    console.log('  ✗ FOUND:')
    for (const v of squatLungeJump) console.log(`    • ${v}`)
  }
} else {
  console.log('  (no recommendations generated)')
}

// ---------------------------------------------------------------------------
// 4. Wrist limitation + sparse equipment (home bodyweight only)
// ---------------------------------------------------------------------------
section('4. WRIST + BODYWEIGHT — graceful degradation test')

const wristProfile = profile({
  primaryGoal: 'build_muscle',
  fitnessLevel: 'beginner',
  daysPerWeek: 3,
  workoutDuration: '30_45',
  trainingLocation: 'home',
  equipment: ['bodyweight'],
  limitations: 'wrist pain, tennis elbow',
  ageRange: '25_34',
})

const wristRecs = generateFromOnboardingData(wristProfile)
const wristTop = wristRecs[0]
const wristLimitText = 'wrist pain, tennis elbow'

console.log('\nProfile: beginner, 3d, home, bodyweight only, wrist limitation (non-senior)')
if (!wristTop) {
  console.log('  (no recommendations generated — empty degradation)')
} else {
  printRecommendation(wristTop)
  const violations = anyAvoidedInRec(wristTop, wristLimitText, false)
  console.log('\n--- Avoid-pattern violation check ---')
  if (violations.length === 0) {
    console.log('  ✓ No push-up/dip/skull-crusher/barbell-curl avoided patterns in output')
  } else {
    console.log('  ✗ VIOLATIONS FOUND:')
    for (const v of violations) console.log(`    • ${v}`)
  }
  const pushDip = wristTop.schedule.flatMap((d) =>
    d.exercises
      .filter((e) => /push[\s-]?up|dip|skull crusher|barbell curl/i.test(e.name))
      .map((e) => `${d.name}: ${e.name}`),
  )
  console.log('\n--- Explicit push-up/dip/skull-crusher check ---')
  if (pushDip.length === 0) {
    console.log('  ✓ None appear in output')
  } else {
    console.log('  ✗ FOUND:')
    for (const v of pushDip) console.log(`    • ${v}`)
  }
  const slotCounts = wristTop.schedule.map((d) => ({
    day: d.name,
    count: d.exercises.length,
  }))
  console.log('\n--- Exercise count per day (may be < budget when pool is sparse) ---')
  for (const { day, count } of slotCounts) {
    console.log(`  ${day}: ${count} exercises`)
  }
}

console.log('\n')
