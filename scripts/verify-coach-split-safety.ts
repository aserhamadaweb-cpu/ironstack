/**
 * Coach chat split safety — mirrors proposeSplitTool post-filter path.
 *
 *   npx tsx scripts/verify-coach-split-safety.ts
 *
 * Offline — no Supabase or Gemini.
 */

import { buildSplitProposal } from '../lib/ai/proposals'
import {
  enforceSafetyOnSplitProposal,
  shouldAvoidExercise,
  limitationText,
  userPromptFromSplitProposal,
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

function coachProposal(input: {
  name: string
  description: string
  daysPerWeek: number
  days: Array<{
    name: string
    subtitle?: string
    exercises: Array<{ name: string; sets?: number; reps?: string }>
  }>
}) {
  const built = buildSplitProposal({
    kind: 'create_split',
    name: input.name,
    description: input.description,
    daysPerWeek: input.daysPerWeek,
    days: input.days,
  })
  if (!built.ok) throw new Error(built.error)
  return built.proposal
}

console.log('\nCoach split safety — proposeSplitTool path\n')

// Case 1: shoulder limitation + overhead press in proposal (Coach chat path)
const shoulderProfile = profile({
  limitations: 'shoulder impingement',
  daysPerWeek: 3,
})
const shoulderInput = inputFromOnboarding(shoulderProfile)!
const shoulderBuilt = coachProposal({
  name: 'Push Day',
  description: 'Push day with overhead press',
  daysPerWeek: 1,
  days: [
    {
      name: 'Push',
      subtitle: 'Chest and shoulders',
      exercises: [
        { name: 'Barbell Bench Press', sets: 3, reps: '8-12' },
        { name: 'Standing Overhead Press', sets: 3, reps: '8-12' },
      ],
    },
  ],
})

const shoulderPrompt = userPromptFromSplitProposal(shoulderBuilt)
const shoulderSafe = enforceSafetyOnSplitProposal(
  shoulderBuilt,
  shoulderInput,
  shoulderPrompt,
)

check('Shoulder/OHP — proposal builds', Boolean(shoulderSafe.proposal))
const shoulderNames = shoulderSafe.proposal.days.flatMap((d) =>
  d.exercises.map((e) => e.name),
)
const limitText = limitationText(shoulderInput)
const hasBlockedOh = shoulderNames.some(
  (n) =>
    /overhead|military press|behind the neck/i.test(n) &&
    shouldAvoidExercise(n, limitText, shoulderInput.seniorMode),
)
check('Shoulder/OHP — overhead press removed from proposal', !hasBlockedOh, shoulderNames.join(', '))
check(
  'Shoulder/OHP — warnings returned on proposal',
  (shoulderSafe.proposal.warnings ?? []).length > 0,
  shoulderSafe.warnings.join(' | '),
)
check(
  'Shoulder/OHP — warning mentions limitation or overhead',
  (shoulderSafe.warnings ?? []).some((w) =>
    /overhead|limitation|conflict|removed|substitut|safer/i.test(w),
  ),
  shoulderSafe.warnings.join(' | '),
)

// Case 2: senior 6-day bro split
const seniorProfile = profile({
  ageRange: '55_plus',
  daysPerWeek: 6,
})
const seniorInput = inputFromOnboarding(seniorProfile)!
check('Senior case — input days capped at 5', seniorInput.daysPerWeek === 5)

const seniorBuilt = coachProposal({
  name: '6-Day Bro Split',
  description: 'Classic bro split chest back arms',
  daysPerWeek: 6,
  days: Array.from({ length: 6 }, (_, i) => ({
    name: `Day ${i + 1}`,
    exercises: [{ name: 'Barbell Bench Press', sets: 3, reps: '8-12' }],
  })),
})

const seniorPrompt = userPromptFromSplitProposal(seniorBuilt)
const seniorSafe = enforceSafetyOnSplitProposal(
  seniorBuilt,
  seniorInput,
  seniorPrompt,
)

check(
  'Senior 6-day — warnings mention day cap or bro split',
  (seniorSafe.warnings ?? []).some((w) =>
    /6|5|day|bro|senior|recovery|recommend/i.test(w),
  ),
  seniorSafe.warnings.join(' | '),
)
check(
  'Senior 6-day — warnings on proposal object',
  (seniorSafe.proposal.warnings ?? []).length > 0,
)

const seniorLimit = limitationText(seniorInput)
const seniorBlocked = seniorSafe.proposal.days
  .flatMap((d) => d.exercises.map((e) => e.name))
  .some((n) => shouldAvoidExercise(n, seniorLimit, true))
check('Senior 6-day — no senior-blocked exercises remain', !seniorBlocked)

// Case 3: tool result shape includes warnings array (simulate proposeSplitTool return)
const toolResult = {
  status: 'pending_confirmation',
  proposal: shoulderSafe.proposal,
  warnings: shoulderSafe.warnings,
}
check(
  'Tool result — warnings[] present alongside proposal',
  Array.isArray(toolResult.warnings) && toolResult.warnings.length > 0,
)
check(
  'Tool result — proposal.warnings mirrors enforcement',
  (toolResult.proposal.warnings ?? []).length > 0,
)

console.log(`\n${passed} passed, ${failures.length} failed\n`)
if (failures.length > 0) {
  console.error(failures.join('\n\n'))
  process.exit(1)
}
