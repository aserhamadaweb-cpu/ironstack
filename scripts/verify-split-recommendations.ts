/**
 * Sample-profile checks for the split recommendation engine.
 *
 *   npx tsx scripts/verify-split-recommendations.ts
 *
 * Offline — loads the exercise catalog from disk, no Supabase.
 */

import {
  generateFromOnboardingData,
  inputFromOnboarding,
} from '../lib/split-recommendations/generate'
import {
  emptyOnboardingData,
  type OnboardingData,
} from '../lib/onboarding-types'

let passed = 0
const failures: string[] = []

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures.push(detail ? `${label}\n      ${detail}` : label)
  console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
}

function profile(
  id: string,
  overrides: Partial<OnboardingData>,
): OnboardingData {
  return {
    ...emptyOnboardingData(),
    step: 8,
    primaryGoal: 'build_muscle',
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    workoutDuration: '30_45',
    trainingLocation: 'home',
    equipment: ['bodyweight', 'bands'],
    trainingStyles: ['full_body'],
    ...overrides,
  }
}

function topTemplateIds(data: OnboardingData): string[] {
  return generateFromOnboardingData(data).map((r) => r.templateId)
}

function accessorySetsForFirstRec(data: OnboardingData): number | null {
  const rec = generateFromOnboardingData(data)[0]
  const day = rec?.schedule[0]
  if (!day || day.exercises.length < 4) return null
  // First accessory slot follows 3 main patterns in FB_MAIN template.
  const acc = day.exercises[3]
  return acc && !acc.isFinisher ? acc.sets : null
}

console.log('\nSplit recommendation engine — sample profiles\n')

// Profile A: beginner, 3d, home, bodyweight+bands, hypertrophy
const profileA = profile('A', {
  primaryGoal: 'build_muscle',
  fitnessLevel: 'beginner',
  daysPerWeek: 3,
  trainingLocation: 'home',
  equipment: ['bodyweight', 'bands'],
  trainingStyles: ['full_body'],
})
const idsA = topTemplateIds(profileA)
check(
  'Profile A — 3-day pool excludes PPL',
  !idsA.some((id) => id.startsWith('ppl')),
  `got: ${idsA.join(', ')}`,
)
check(
  'Profile A — includes home-friendly template',
  idsA.some((id) => id === 'home_minimal' || id === 'full_body' || id === 'upper_lower_3'),
  `got: ${idsA.join(', ')}`,
)
check(
  'Profile A — beginner accessory sets = 2',
  accessorySetsForFirstRec(profileA) === 2,
  `first accessory sets: ${accessorySetsForFirstRec(profileA)}`,
)

// Profile B: advanced, 6d, gym, strength+muscle
const profileB = profile('B', {
  primaryGoal: 'get_stronger',
  secondaryGoals: ['build_muscle'],
  fitnessLevel: 'advanced',
  daysPerWeek: 6,
  trainingLocation: 'gym',
  equipment: ['barbell', 'dumbbells', 'machines', 'pullup_bar'],
  trainingStyles: ['ppl', 'strength'],
  ageRange: '25_34',
})
const idsB = topTemplateIds(profileB)
check(
  'Profile B — top pick is PPL 6-day for advanced 6d gym',
  idsB[0] === 'ppl_6',
  `top: ${idsB[0]}, all: ${idsB.join(', ')}`,
)

// Profile C: intermediate, 4d, dumbbells, fat loss
const profileC = profile('C', {
  primaryGoal: 'lose_fat',
  fitnessLevel: 'intermediate',
  daysPerWeek: 4,
  trainingLocation: 'home',
  equipment: ['dumbbells', 'bodyweight'],
  trainingStyles: ['upper_lower'],
})
const recC = generateFromOnboardingData(profileC)[0]
check(
  'Profile C — hybrid/metcon or UL in top results for fat loss 4d',
  topTemplateIds(profileC).some((id) =>
    ['hybrid_metcon', 'upper_lower', 'full_body_4'].includes(id),
  ),
  `top: ${topTemplateIds(profileC).join(', ')}`,
)
const hasFinisher = recC?.schedule.some(
  (d) => d.finisherNote || d.exercises.some((e) => e.isFinisher),
)
check(
  'Profile C — finisher circuits on lifting days (not separate day)',
  Boolean(hasFinisher),
  'no finisher on top recommendation',
)

// Profile D: 55+ age adjustment
const profileSenior = profile('Senior', {
  primaryGoal: 'build_muscle',
  fitnessLevel: 'advanced',
  daysPerWeek: 6,
  trainingLocation: 'gym',
  equipment: ['barbell', 'dumbbells', 'machines'],
  trainingStyles: ['ppl'],
  ageRange: '55_plus',
})
const inputSenior = inputFromOnboarding(profileSenior)
check(
  '55+ — caps effective days at 5',
  inputSenior?.daysPerWeek === 5 && inputSenior.statedDaysPerWeek === 6,
  `effective=${inputSenior?.daysPerWeek}, stated=${inputSenior?.statedDaysPerWeek}`,
)
check(
  '55+ — seniorMode enabled',
  inputSenior?.seniorMode === true,
)
const idsSenior = topTemplateIds(profileSenior)
check(
  '55+ — never recommends bro_5 or ppl_6',
  !idsSenior.includes('bro_5') && !idsSenior.includes('ppl_6'),
  `got: ${idsSenior.join(', ')}`,
)
check(
  '55+ — reduced accessory volume (≤2 sets on accessories)',
  (() => {
    const rec = generateFromOnboardingData(profileSenior)[0]
    const accSets = rec?.schedule.flatMap((d) =>
      d.exercises.filter((e) => !e.isFinisher && e.sets <= 3).map((e) => e.sets),
    )
    return accSets?.every((s) => s <= 2) ?? false
  })(),
)

// Limitations: swap only, no template exclusion
const profileKnee = profile('Knee', {
  limitations: 'bad knee, avoid deep squats',
  daysPerWeek: 4,
  fitnessLevel: 'intermediate',
  trainingLocation: 'gym',
  equipment: ['barbell', 'machines'],
})
const recKnee = generateFromOnboardingData(profileKnee)[0]
const squatNames =
  recKnee?.schedule.flatMap((d) => d.exercises.map((e) => e.name.toLowerCase())) ?? []
check(
  'Knee limitation — avoids squat/lunge names where possible',
  !squatNames.some((n) => /barbell full squat|walking lunge|jump squat/.test(n)),
  `exercises: ${squatNames.slice(0, 8).join(', ')}`,
)

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  • ${f}`)
  process.exit(1)
}

console.log('\nAll split recommendation checks passed.\n')
