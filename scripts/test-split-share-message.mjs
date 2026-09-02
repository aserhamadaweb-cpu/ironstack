import assert from 'node:assert/strict'
import {
  encodeSplitShareMessage,
  parseSplitShareMessage,
  splitShareInboxPreview,
} from '../lib/split-share-message.ts'

const payload = {
  v: 1,
  splitId: '11111111-1111-4111-8111-111111111111',
  shareToken: 'abc123token',
  name: 'Push / Pull',
  daysPerWeek: 4,
  category: 'Strength',
  exerciseCount: 12,
  note: 'Try this',
}

const encoded = encodeSplitShareMessage(payload)
assert.ok(encoded.startsWith('ironstack:split-share:v1'))
assert.deepEqual(parseSplitShareMessage(encoded), payload)
assert.equal(splitShareInboxPreview(encoded), 'Push / Pull')
assert.equal(parseSplitShareMessage('hello'), null)

console.log('split-share-message tests passed')
