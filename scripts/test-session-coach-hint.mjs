import assert from 'node:assert/strict'
import {
  markSessionCoachDiscovered,
  markSessionCoachTooltipShown,
  registerSessionCoachImpression,
  sessionCoachHintActive,
  SESSION_COACH_HINT_MAX_IMPRESSIONS,
} from '../lib/session-coach-hint.ts'

let state = { impressions: 0, discovered: false, tooltipShown: false }

const first = registerSessionCoachImpression(state)
assert.equal(first.impressions, 1)
assert.equal(first.showAttention, true)
assert.equal(sessionCoachHintActive(first), true)
state = first

const second = registerSessionCoachImpression(state)
assert.equal(second.impressions, 2)
assert.equal(second.showAttention, true)
state = second

const third = registerSessionCoachImpression(state)
assert.equal(third.impressions, 3)
assert.equal(third.showAttention, true)
assert.equal(sessionCoachHintActive(third), false)
state = third

const fourth = registerSessionCoachImpression(state)
assert.equal(fourth.impressions, 3)
assert.equal(fourth.showAttention, false)

state = markSessionCoachDiscovered({ impressions: 1, discovered: false, tooltipShown: false })
assert.equal(state.discovered, true)
assert.equal(sessionCoachHintActive(state), false)

state = markSessionCoachTooltipShown({ impressions: 0, discovered: false, tooltipShown: false })
assert.equal(state.tooltipShown, true)

assert.equal(SESSION_COACH_HINT_MAX_IMPRESSIONS, 3)
console.log('session-coach-hint: ok')
