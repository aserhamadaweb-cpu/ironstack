import assert from 'node:assert/strict'
import {
  buildSessionCoachContext,
  formatSessionContextForPrompt,
  parseSessionCoachContext,
} from '../lib/ai/session-context.ts'

const ctx = buildSessionCoachContext({
  splitName: 'Push Pull Legs',
  dayName: 'Push A',
  dayNote: 'Heavy compounds',
  exerciseIndex: 0,
  totalExercises: 5,
  elapsedSeconds: 610,
  exercise: {
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    liftTypeId: '0025',
    sets: 4,
    reps: '6–10',
  },
  entries: [
    {
      weight: '80',
      reps: '8',
      durationMinutes: '',
      done: true,
      skipped: false,
      saved: true,
    },
    {
      weight: '82.5',
      reps: '7',
      durationMinutes: '',
      done: true,
      skipped: false,
      saved: true,
    },
    {
      weight: '85',
      reps: '',
      durationMinutes: '',
      done: false,
      skipped: false,
      saved: false,
    },
    { weight: '', reps: '', durationMinutes: '', done: false, skipped: false, saved: false },
  ],
  loggedExercises: [],
  previousBest: { weight: 85, reps: 8 },
  toKg: (n) => n,
})

const prompt = formatSessionContextForPrompt(ctx)
assert.match(prompt, /Barbell Bench Press/)
assert.match(prompt, /Exercise 1 of 5/)
assert.match(prompt, /Sets completed this exercise so far: 2/)
assert.match(prompt, /80 kg × 8 reps logged/)
assert.match(prompt, /Previous best for this lift: 85 kg × 8 reps/)

const parsed = parseSessionCoachContext(ctx)
assert.equal(parsed?.currentExercise.name, 'Barbell Bench Press')
assert.equal(parsed?.loggedSetsThisExercise.length, 2)

console.log('session-coach-context: ok')
