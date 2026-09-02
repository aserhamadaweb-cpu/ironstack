/**
 * Safety checks for the AI custom split builder (offline — no Gemini).
 *
 *   npx tsx scripts/verify-custom-split-safety.ts
 */

import {
  buildCustomSplitFromIntent,
  parseCustomSplitIntentHeuristic,
  shouldAvoidExercise,
  limitationText,
} from '../lib/split-recommendations'
import { inputFromOnboarding } from '../lib/split-recommendations/types'
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

function profile(overrides: Partial<OnboardingData>): OnboardingData {
  return {
    ...emptyOnboardingData(),
    step: 8,
    primaryGoal: 'build_muscle',
    fitnessLevel: 'intermediate',
    daysPerWeek: 4,
    workoutDuration: '45_60',
    trainingLocation: 'gym',
    equipment: ['dumbbells', 'barbell', 'machines'],
    trainingStyles: ['ppl'],
    ...overrides,
  }
}

console.log('\nCustom split builder — safety matrix\n')

// Case 1: shoulder limitation + overhead press request
const shoulderProfile = profile({
  limitations: 'shoulder impingement',
  daysPerWeek: 3,
})
const shoulderInput = inputFromOnboarding(shoulderProfile)!
const shoulderIntent = parseCustomSplitIntentHeuristic(
  '3-day program with overhead press every push day',
  shoulderInput,
)
const shoulderResult = buildCustomSplitFromIntent(
  shoulderIntent,
  shoulderInput,
  '3-day program with overhead press every push day',
)
check('Shoulder case — builds successfully', Boolean(shoulderResult && 'recommendation' in shoulderResult))
if (shoulderResult && 'recommendation' in shoulderResult) {
  const allNames = shoulderResult.recommendation.schedule.flatMap((d) =>
    d.exercises.map((e) => e.name),
  )
  const limitText = limitationText(shoulderInput)
  const hasBlockedOh = allNames.some((n) =>
    /overhead|military press|behind the neck/i.test(n) &&
      shouldAvoidExercise(n, limitText, shoulderInput.seniorMode),
  )
  check('Shoulder case — no blocked overhead press in schedule', !hasBlockedOh, allNames.join(', '))
  check(
    'Shoulder case — warning mentions limitation conflict',
    (shoulderResult.warnings ?? []).some((w) =>
      /overhead|limitation|substitut|conflict|safer/i.test(w),
    ),
    shoulderResult.warnings?.join(' | '),
  )
}

// Case 2: senior 6-day bro split
const seniorProfile = profile({
  ageRange: '55_plus',
  daysPerWeek: 6,
  fitnessLevel: 'intermediate',
})
const seniorInput = inputFromOnboarding(seniorProfile)!
check('Senior case — days capped at 5 in input', seniorInput.daysPerWeek === 5)
const seniorIntent = parseCustomSplitIntentHeuristic(
  '6-day bro split chest back arms',
  seniorInput,
)
const seniorResult = buildCustomSplitFromIntent(
  seniorIntent,
  seniorInput,
  '6-day bro split chest back arms',
)
if (seniorResult && 'recommendation' in seniorResult) {
  check(
    'Senior bro case — schedule uses at most 5 days',
    seniorResult.recommendation.daysPerWeek <= 5,
    String(seniorResult.recommendation.daysPerWeek),
  )
  check(
    'Senior bro case — senior adjustment warning present',
    (seniorResult.warnings ?? []).some((w) => /senior|5|bro|push|pull|capped/i.test(w)),
    seniorResult.warnings?.join(' | '),
  )
  const limitText = limitationText(seniorInput)
  const hasPlyo = seniorResult.recommendation.schedule
    .flatMap((d) => d.exercises.map((e) => e.name))
    .some((n) => shouldAvoidExercise(n, limitText, true))
  check('Senior bro case — no senior-blocked exercises', !hasPlyo)
}

// Case 3: dumbbells-only chest/back
const homeProfile = profile({
  trainingLocation: 'home',
  equipment: ['dumbbells', 'bench'],
  daysPerWeek: 4,
})
const homeInput = inputFromOnboarding(homeProfile)!
const homeIntent = parseCustomSplitIntentHeuristic(
  '4-day chest and back dumbbells only',
  homeInput,
)
const homeResult = buildCustomSplitFromIntent(
  homeIntent,
  homeInput,
  '4-day chest and back dumbbells only',
)
if (homeResult && 'recommendation' in homeResult) {
  check(
    'Dumbbell chest/back — 4 training days',
    homeResult.recommendation.schedule.length === 4,
  )
  check(
    'Dumbbell chest/back — every day has exercises',
    homeResult.recommendation.schedule.every((d) => d.exercises.length >= 3),
  )
}

// Case 4: made-up exercise name in prompt
const gymInput = inputFromOnboarding(profile({ daysPerWeek: 3 }))!
const fakeIntent = parseCustomSplitIntentHeuristic(
  '3-day full body with xyzmadeup exercise as main lift',
  gymInput,
)
const fakeResult = buildCustomSplitFromIntent(
  fakeIntent,
  gymInput,
  '3-day full body with xyzmadeup exercise as main lift',
)
check('Fake exercise case — still produces a program', Boolean(fakeResult && 'recommendation' in fakeResult))

console.log(`\n${passed} passed, ${failures.length} failed\n`)
if (failures.length > 0) {
  console.error(failures.join('\n\n'))
  process.exit(1)
}
