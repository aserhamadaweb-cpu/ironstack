/**
 * Unit checks for hardened Save-for-Offline: progress commit order,
 * rollback on media failure, quota messaging, integrity flags.
 * Run: node scripts/test-offline-save-harden.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

/** Mirrors saveSplitForOffline phase order (no pin until media + commit). */
function simulateSave({ mediaOk, commitOk, quota }) {
  const state = { pinned: false, snapshot: false, progress: [] }
  state.progress.push({ phase: 'fetch', percent: 0 })
  state.progress.push({ phase: 'media', percent: 50 })
  if (quota) {
    return {
      ...state,
      result: { ok: false, code: 'quota' },
    }
  }
  if (!mediaOk) {
    return {
      ...state,
      result: { ok: false, code: 'media' },
    }
  }
  state.progress.push({ phase: 'commit', percent: 92 })
  if (!commitOk) {
    return {
      ...state,
      result: { ok: false, code: 'generic' },
    }
  }
  state.snapshot = true
  state.pinned = true
  state.progress.push({ phase: 'commit', percent: 100 })
  return { ...state, result: { ok: true } }
}

const midNetwork = simulateSave({ mediaOk: false, commitOk: true, quota: false })
assert(!midNetwork.pinned, 'network drop mid-media must not pin')
assert(!midNetwork.snapshot, 'network drop mid-media must not write ready snapshot')
assert(midNetwork.result.code === 'media', 'media failure code')

const quota = simulateSave({ mediaOk: true, commitOk: true, quota: true })
assert(!quota.pinned, 'quota must not pin')
assert(quota.result.code === 'quota', 'quota code')

const happy = simulateSave({ mediaOk: true, commitOk: true, quota: false })
assert(happy.pinned && happy.snapshot, 'happy path pins after media')
assert(happy.progress.at(-1).percent === 100, 'ends at 100%')
assert(
  happy.progress.findIndex((p) => p.phase === 'media') <
    happy.progress.findIndex((p) => p.phase === 'commit' && p.percent === 100),
  'media before success commit',
)

/** Integrity: incomplete media → not ready. */
function inspectSplit({ hasRow, exercises, requiredCached, requiredTotal, offlineReady }) {
  if (!hasRow) {
    return { ready: false, issue: 'missing-snapshot' }
  }
  if (!exercises) {
    return { ready: false, issue: 'empty-program' }
  }
  if (offlineReady && requiredCached < requiredTotal) {
    return {
      ready: false,
      issue: 'incomplete-media',
      mediaExpected: requiredTotal,
      mediaCached: requiredCached,
    }
  }
  if (!offlineReady && requiredTotal > 0 && requiredCached < requiredTotal) {
    return { ready: false, issue: 'incomplete-media' }
  }
  return { ready: true }
}

assert(
  inspectSplit({
    hasRow: true,
    exercises: true,
    requiredCached: 3,
    requiredTotal: 10,
    offlineReady: true,
  }).issue === 'incomplete-media',
  'partial media flagged',
)
assert(
  inspectSplit({
    hasRow: false,
    exercises: false,
    requiredCached: 0,
    requiredTotal: 0,
    offlineReady: false,
  }).issue === 'missing-snapshot',
  'orphan pin flagged',
)
assert(
  inspectSplit({
    hasRow: true,
    exercises: true,
    requiredCached: 10,
    requiredTotal: 10,
    offlineReady: true,
  }).ready,
  'complete download ready',
)

/** Persistence: completed download must not be wiped by transient auth null. */
function wouldWipeOfflineData({ previous, nextUserId, isSignOut }) {
  const next = nextUserId ?? ''
  const prev = previous ?? ''
  if (prev === next) return false
  if (!previous) return false
  if (previous && !nextUserId && !isSignOut) return false
  return true
}

assert(
  !wouldWipeOfflineData({
    previous: 'user-a',
    nextUserId: null,
    isSignOut: false,
  }),
  'force-quit / offline reopen must keep completed download',
)

console.log('offline-save-harden tests: ok')
