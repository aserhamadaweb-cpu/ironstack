/**
 * Offline smoke checks for profile interview helpers + completeness.
 * Run: npx tsx scripts/smoke-ai-profile-interview.ts
 */
import assert from 'node:assert/strict'
import {
  answersToOnboardingPatch,
  emptyStepAnswer,
  isProfileInterviewStepComplete,
  orderProfileInterviewFields,
  isProfileInterviewPayload,
} from '../lib/ai/profile-interview'
import {
  getMissingProfileFields,
  completenessFromOnboarding,
} from '../lib/profile-completeness'
import { emptyOnboardingData } from '../lib/onboarding-types'

let passed = 0
function check(label: string, ok: boolean) {
  if (!ok) throw new Error(`FAIL: ${label}`)
  passed += 1
  console.log(`  ✓ ${label}`)
}

console.log('\nProfile completeness')
{
  const empty = getMissingProfileFields({})
  check('empty profile is incomplete', empty.length >= 5)

  const full = getMissingProfileFields({
    weightKg: 80,
    heightCm: 180,
    gender: 'male',
    ageRange: '25_34',
    primaryGoal: 'build_muscle',
    fitnessLevel: 'intermediate',
    daysPerWeek: 4,
    workoutDuration: '45_60',
    trainingLocation: 'gym',
  })
  check('full profile has no missing fields', full.length === 0)

  const preferNot = getMissingProfileFields({
    weightKg: 80,
    heightCm: 180,
    gender: 'prefer_not',
    ageRange: 'prefer_not',
    primaryGoal: 'build_muscle',
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    workoutDuration: '30_45',
    trainingLocation: 'home',
  })
  check('prefer_not gender/age counts as set', preferNot.length === 0)
}

console.log('\nInterview field order')
{
  const ordered = orderProfileInterviewFields([
    'weight',
    'primary_goal',
    'training_location',
    'days_per_week',
  ])
  check(
    'goals/schedule before body',
    ordered[0] === 'primary_goal' && ordered.includes('weight'),
  )
}

console.log('\nStep completeness + patch')
{
  const goal = emptyStepAnswer('primary_goal', 'kg')
  check('empty goal incomplete', !isProfileInterviewStepComplete('primary_goal', goal))
  goal.choiceIds = ['build_muscle']
  check('goal choice complete', isProfileInterviewStepComplete('primary_goal', goal))

  const weight = emptyStepAnswer('weight', 'lb')
  weight.numberValue = '180'
  weight.unit = 'lb'
  check('weight lb complete', isProfileInterviewStepComplete('weight', weight))

  const patch = answersToOnboardingPatch({
    primary_goal: goal,
    weight,
    days_per_week: { choiceIds: ['days_4'], numberValue: '', unit: 'kg' },
    training_location: { choiceIds: ['gym'], numberValue: '', unit: 'kg' },
  })
  check('patch goal', patch.primaryGoal === 'build_muscle')
  check('patch days', patch.daysPerWeek === 4)
  check('patch location', patch.trainingLocation === 'gym')
  check('patch weight kg converted', typeof patch.weightKg === 'number' && (patch.weightKg as number) > 70)
}

console.log('\nPayload guard')
{
  check(
    'valid interview payload',
    isProfileInterviewPayload({
      status: 'pending_confirmation',
      interviewId: 'abc',
      fields: ['primary_goal', 'weight'],
      preferredUnit: 'kg',
    }),
  )
  check(
    'rejects empty fields',
    !isProfileInterviewPayload({
      status: 'pending_confirmation',
      interviewId: 'abc',
      fields: [],
    }),
  )
}

console.log('\nOnboarding completeness helper')
{
  const data = emptyOnboardingData()
  const missing = getMissingProfileFields(completenessFromOnboarding(data))
  check('empty onboarding yields missing fields', missing.length > 0)
}

console.log(`\nPASS — ${passed} checks\n`)
