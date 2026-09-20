/**
 * Unit checks for offline pin list filtering + unsave retention rules.
 * Run: node scripts/test-offline-pins.mjs
 */

function listOfflineSavedSplits(pins, rows) {
  const pinSet = new Set(pins)
  return rows
    .filter(
      (row) =>
        pinSet.has(row.id) && !row.row.is_system && Boolean(row.row.user_id),
    )
    .map((row) => ({ id: row.id, name: row.detail.name }))
}

function removeSplitFromOffline(pins, splitId, { session, mutation }) {
  const nextPins = pins.filter((id) => id !== splitId)
  const snapshotRemoved = !session && !mutation
  return {
    pins: nextPins,
    snapshotRemoved,
    retainedForSession: session,
    retainedForMutation: mutation,
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const rows = [
  {
    id: 'a',
    detail: { name: 'Push' },
    row: { user_id: 'u1', is_system: false },
  },
  {
    id: 'b',
    detail: { name: 'Pull' },
    row: { user_id: 'u1', is_system: false },
  },
  {
    id: 'sys',
    detail: { name: 'System' },
    row: { user_id: null, is_system: true },
  },
  {
    id: 'ghost',
    detail: { name: 'Auto-cached leftover' },
    row: { user_id: 'u1', is_system: false },
  },
]

const listed = listOfflineSavedSplits(['a', 'b'], rows)
assert(listed.length === 2, 'pin list should be exactly pinned customs')
assert(
  listed.every((row) => row.id === 'a' || row.id === 'b'),
  'ghost/system must not appear',
)

const empty = listOfflineSavedSplits([], rows)
assert(empty.length === 0, 'zero pins → empty list')

const midSession = removeSplitFromOffline(['a', 'b'], 'a', {
  session: true,
  mutation: false,
})
assert(midSession.pins.length === 1 && midSession.pins[0] === 'b', 'unpinned')
assert(!midSession.snapshotRemoved, 'keep snapshot mid-session')
assert(midSession.retainedForSession, 'flag session retention')

const pendingMut = removeSplitFromOffline(['b'], 'b', {
  session: false,
  mutation: true,
})
assert(pendingMut.pins.length === 0, 'unpinned all')
assert(!pendingMut.snapshotRemoved, 'keep snapshot for mutation')
assert(pendingMut.retainedForMutation, 'flag mutation retention')

const clean = removeSplitFromOffline(['a'], 'a', {
  session: false,
  mutation: false,
})
assert(clean.snapshotRemoved, 'drop snapshot when safe')

console.log('offline-pins tests: ok')
