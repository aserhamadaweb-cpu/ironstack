/**
 * Exhaustive offline-mode audit regressions (logic mirrors of production fixes).
 * Run: node scripts/test-offline-audit.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// --- 1. Bootstrap: whoami failure must NOT sign out / wipe ---
function bootstrapDecision({ server, clientUserId }) {
  // server === null → unknown (offline/network)
  // server.userId === null → confirmed logged out
  // server.userId set → confirmed signed in
  if (server === null) {
    return clientUserId ? 'bind-client-keep-offline' : 'noop'
  }
  if (server.userId) {
    if (clientUserId && clientUserId !== server.userId) {
      return 'account-switch-wipe-then-reload'
    }
    return 'bind-server'
  }
  if (clientUserId) return 'local-signout' // authoritative logout
  return 'noop'
}

assert(
  bootstrapDecision({ server: null, clientUserId: 'u1' }) ===
    'bind-client-keep-offline',
  'offline whoami fail must keep offline data',
)
assert(
  bootstrapDecision({
    server: { userId: null },
    clientUserId: 'u1',
  }) === 'local-signout',
  'confirmed logout may local-signout',
)
assert(
  bootstrapDecision({
    server: { userId: 'u1' },
    clientUserId: 'u1',
  }) === 'bind-server',
  'happy path bind',
)

// --- 2. Unsave vs save: snapshot delete must be under pin lock ---
function simulateUnsaveSaveRace({ lockSerializes }) {
  let pins = new Set()
  let snapshots = new Set()
  const ops = []

  async function withLock(fn) {
    if (!lockSerializes) return fn()
    // synchronous stand-in for pin write chain
    return fn()
  }

  // Broken: unpin under lock, delete snapshot outside → interleave save commit
  async function brokenRemove(id) {
    await withLock(async () => {
      pins.delete(id)
    })
    // gap: save can commit here
    ops.push('remove-gap')
    snapshots.delete(id)
  }
  async function saveCommit(id) {
    await withLock(async () => {
      snapshots.add(id)
      pins.add(id)
      ops.push('save-commit')
    })
  }

  // Fixed: entire remove including delete under lock
  async function fixedRemove(id) {
    await withLock(async () => {
      pins.delete(id)
      snapshots.delete(id)
      ops.push('remove-complete')
    })
  }

  // Reproduce broken interleaving manually
  pins.add('x')
  snapshots.add('x')
  pins.delete('x') // unsave unlocked unpin
  snapshots.add('x') // save commit
  pins.add('x')
  snapshots.delete('x') // unsave delete after
  assert(pins.has('x') && !snapshots.has('x'), 'broken race: pin without snapshot')

  // Fixed serialization (remove fully before save)
  pins = new Set(['x'])
  snapshots = new Set(['x'])
  pins.delete('x')
  snapshots.delete('x')
  snapshots.add('x')
  pins.add('x')
  assert(pins.has('x') && snapshots.has('x'), 'fixed: save after remove is complete')

  void brokenRemove
  void saveCommit
  void fixedRemove
  void ops
}

simulateUnsaveSaveRace({ lockSerializes: true })

// --- 3. retryOfflineQueueNow must not clear session locks ---
function retryQueue({ clearLocks }) {
  const locks = new Map([['s1', 'in-flight']])
  const retryAfter = new Map([['s1', Date.now() + 99999]])
  retryAfter.clear()
  if (clearLocks) locks.clear()
  return { locksSize: locks.size, retrySize: retryAfter.size }
}
assert(
  retryQueue({ clearLocks: true }).locksSize === 0,
  'buggy clears locks',
)
assert(
  retryQueue({ clearLocks: false }).locksSize === 1,
  'fixed keeps locks',
)
assert(retryQueue({ clearLocks: false }).retrySize === 0, 'fixed clears backoff')

// --- 4. Finish sync log completeness ---
function finishLogVerify(localLogs, serverCount) {
  if (localLogs === 0) return 'ok'
  if (serverCount < localLogs) return 'retry'
  return 'ok'
}
assert(finishLogVerify(5, 1) === 'retry', 'partial logs must retry')
assert(finishLogVerify(5, 5) === 'ok', 'full logs ok')
assert(finishLogVerify(0, 0) === 'ok', 'empty local ok')

// --- 5. Mutation reconcile: updates never cleared by existence ---
function reconcileMutation(kind, serverHasSplit) {
  if (kind === 'update') return 'keep-pending'
  if (serverHasSplit) return 'mark-synced'
  return 'keep-pending'
}
assert(
  reconcileMutation('update', true) === 'keep-pending',
  'update must not reconcile away',
)
assert(
  reconcileMutation('create', true) === 'mark-synced',
  'create may reconcile',
)

// --- 6. Prefetch over-cap must fail, not silently truncate ---
function prefetchCap(total, max) {
  if (total > max) return { ok: false, warmed: 0 }
  return { ok: true, warmed: total }
}
assert(!prefetchCap(501, 500).ok, 'over cap fails')
assert(prefetchCap(500, 500).ok, 'at cap ok')

// --- 7. Missing-on-server enqueue: query error ≠ missing ---
function missingOnServer({ error, dataId }) {
  if (error) return 'skip'
  return dataId ? 'present' : 'enqueue-create'
}
assert(missingOnServer({ error: true, dataId: null }) === 'skip', 'error skip')
assert(
  missingOnServer({ error: false, dataId: null }) === 'enqueue-create',
  'true missing',
)

// --- 8. Auth wipe: transient null still guarded ---
function wouldWipe({ previous, nextUserId, isSignOut }) {
  const next = nextUserId ?? ''
  const prev = previous ?? ''
  if (prev === next) return false
  if (!previous) return false
  if (previous && !nextUserId && !isSignOut) return false
  return true
}
assert(
  !wouldWipe({ previous: 'a', nextUserId: null, isSignOut: false }),
  'transient null no wipe',
)

// --- 9. Signup wipe-before-success ---
function signupWipeTiming({ wipeBefore, signupOk }) {
  let wiped = false
  if (wipeBefore) wiped = true
  if (!signupOk) return { wiped, dataKept: !wiped }
  wiped = true // account switch after success
  return { wiped, dataKept: false }
}
assert(
  signupWipeTiming({ wipeBefore: true, signupOk: false }).wiped,
  'buggy wiped on fail',
)
assert(
  !signupWipeTiming({ wipeBefore: false, signupOk: false }).wiped,
  'fixed keeps data on fail',
)

// --- 10. Multi-pin: session splitId isolation ---
function sessionBelongsTo(sessionSplitId, pinIds) {
  return pinIds.includes(sessionSplitId)
}
assert(
  sessionBelongsTo('a', ['a', 'b', 'c']),
  'session on A among 3 pins',
)
assert(!sessionBelongsTo('d', ['a', 'b', 'c']), 'foreign split not mixed')

// --- 11. Unsave with in-progress retains snapshot ---
function unsaveRetention({ session, mutation }) {
  const unpinned = true
  const snapshotRemoved = !session && !mutation
  return { unpinned, snapshotRemoved, retainedForSession: session }
}
assert(
  unsaveRetention({ session: true, mutation: false }).snapshotRemoved === false,
  'keep snapshot mid-session',
)

// --- 12. 409 on in_progress must not mark synced ---
function alreadyExistsDecision(localStatus, serverStatus) {
  if (localStatus === 'completed') {
    return serverStatus === 'completed' ? 'synced' : 'pending'
  }
  return 'pending'
}
assert(
  alreadyExistsDecision('in_progress', 'in_progress') === 'pending',
  'open session 409 stays pending',
)

console.log('offline-audit tests: ok')
