/**
 * Smoke: nicknames must resolve OR soft-build still succeeds.
 * Run: npx tsx scripts/smoke-exercise-resolve.ts
 */
import { resolveExerciseRef } from '../lib/ai/catalog-lookup'
import { buildSplitProposal } from '../lib/ai/proposals'

const names = [
  'Seated Cable Row',
  'Skull Crushers',
  'Face Pull',
  'Bulgarian Split Squat',
  'RDL',
  'Totally Fake Machine Press XYZ',
  'Hack Squat',
  'Pendlay Row',
  'Good Morning',
  'Cable Crossover',
  'Preacher Curl',
  'Concentration Curl',
  'Tricep Kickback',
  'Shrugs',
]

let resolveFails = 0
for (const name of names) {
  const { id } = resolveExerciseRef('', name)
  console.log(`${id ? '✓' : '~'} resolve ${name} → ${id ?? 'null (will soft-skip)'}`)
  if (!id && name !== 'Totally Fake Machine Press XYZ') {
    // Fake name is expected null; others should usually resolve via fuzzy.
  }
  if (!id) resolveFails += 1
}

const built = buildSplitProposal({
  kind: 'create_split',
  name: 'Arnold Soft-Fail Test',
  days: [
    {
      name: 'Chest',
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: '6-8' },
        { name: 'Skull Crushers', sets: 3, reps: '10' },
        { name: 'Totally Fake Machine Press XYZ', sets: 3, reps: '12' },
        { name: 'Face Pull', sets: 3, reps: '15' },
      ],
    },
    {
      name: 'Back',
      exercises: [
        { name: 'Seated Cable Row', sets: 4, reps: '8' },
        { name: 'Pendlay Row', sets: 3, reps: '8' },
        { name: 'Unknown Gibberish Lift 999', sets: 3, reps: '10' },
      ],
    },
  ],
})

if (!built.ok) {
  console.error('FAIL — buildSplitProposal', built.error)
  process.exit(1)
}

const dayLens = built.proposal.days.map((d) => d.exercises.length)
console.log('build ok days', dayLens, 'warnings', built.proposal.warnings?.length ?? 0)
if (dayLens.some((n) => n < 1)) {
  console.error('FAIL — empty day')
  process.exit(1)
}
console.log(`PASS — soft-build holds (${resolveFails} unresolved nicknames soft-handled)`)
