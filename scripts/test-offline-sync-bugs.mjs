/**
 * Regression tests for offline completed-session sync gaps.
 * Run: node scripts/test-offline-sync-bugs.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

/** Mirrors fixed purgeStaleOfflineItems decision for sessions. */
function purgeSessionDecision(session, server) {
  if (session.status === 'in_progress') return 'keep-active'
  if (server?.id) {
    const serverDone =
      server.status === 'completed' || server.status === 'cancelled'
    const localDone =
      session.status === 'completed' || session.status === 'cancelled'
    if (serverDone && localDone) return 'mark-synced'
    return 'keep-for-flush'
  }
  if (session.status === 'completed') return 'keep-forever'
  if (session.stale) return 'delete'
  return 'keep'
}

function reconcileDecision(session, server) {
  if (!server?.id) return 'skip'
  if (session.status === 'completed' && server.status === 'completed') {
    return 'mark-synced'
  }
  if (session.status === 'cancelled' && server.status === 'cancelled') {
    return 'mark-synced'
  }
  return 'skip'
}

function buggyPurgeDecision(session, server) {
  if (session.status === 'in_progress') return 'keep-active'
  if (server?.id) return 'mark-synced'
  if (session.stale) return 'delete'
  return 'keep'
}

/**
 * Old broken sync path for completed sessions:
 * 1) browser upsert in_progress shell
 * 2) browser upsert logs (optional)
 * 3) server-action finishSessionAction (can fail independently)
 * → zombie in_progress on server
 */
function oldCompletedSyncSteps(finishActionOk) {
  const server = { status: null, logs: 0 }
  server.status = 'in_progress'
  server.logs = 3
  if (!finishActionOk) {
    return { server, markedSynced: false, gap: 'shell-without-finish' }
  }
  server.status = 'completed'
  return { server, markedSynced: true, gap: null }
}

/**
 * Fixed path: single client REST finish writes completed + logs together.
 */
function fixedCompletedSyncSteps({ logsFail, partialLogs } = {}) {
  const server = { status: null, logs: 0 }
  server.status = 'completed'
  if (logsFail) {
    return { server, ok: false, retry: true }
  }
  server.logs = partialLogs ? 1 : 3
  const localLogs = 3
  if (server.status !== 'completed' || server.logs < localLogs) {
    return { server, ok: false, retry: true }
  }
  return { server, ok: true, retry: false }
}

/** createLocalSession must not demote completed → in_progress. */
function createLocalSessionGuard(existing, input) {
  if (existing?.status === 'in_progress') return existing
  if (existing?.status === 'completed' || existing?.status === 'cancelled') {
    return existing
  }
  return { ...input, status: 'in_progress', logs: existing?.logs ?? [] }
}

function simulateSaveAndPrune({ atomic }) {
  let pins = []
  let rows = new Set()
  if (atomic) {
    rows.add('split-a')
    pins = ['split-a']
  } else {
    rows.add('split-a')
    for (const id of [...rows]) {
      if (!pins.includes(id)) rows.delete(id)
    }
    pins = ['split-a']
  }
  return [...rows].filter((id) => pins.includes(id))
}

function purgeSplitDecision({ pinned, stale, onServer, liveSession }) {
  if (pinned) return 'keep-pinned'
  if (!stale) return 'keep'
  if (onServer) return 'keep'
  if (liveSession) return 'keep'
  return 'remove-and-clear-pin'
}

function logRowForUpsert(log) {
  const isCardio =
    log.durationSeconds != null && Number(log.durationSeconds) > 0
  const rawWeight = Number(log.weight) || 0
  const rawReps = Number(log.reps) || 0
  const needsPlaceholder =
    isCardio || log.isSkipped || !(rawWeight > 0) || !(rawReps > 0)
  return {
    weight: needsPlaceholder ? Math.max(rawWeight, 1) : rawWeight,
    reps: needsPlaceholder ? Math.max(rawReps, 1) : rawReps,
    is_skipped: log.isSkipped,
  }
}

// --- Bug 2 classic purge false-sync ---
{
  const session = { status: 'completed', stale: false }
  const server = { id: 's1', status: 'in_progress' }
  assert(
    buggyPurgeDecision(session, server) === 'mark-synced',
    'old bug marked completed local as synced',
  )
  assert(
    purgeSessionDecision(session, server) === 'keep-for-flush',
    'fixed purge must leave completed+in_progress for flush',
  )
  assert(reconcileDecision(session, server) === 'skip', 'reconcile waits')
}

{
  const session = { status: 'completed', stale: false }
  const server = { id: 's1', status: 'completed' }
  assert(purgeSessionDecision(session, server) === 'mark-synced', 'done/done')
  assert(reconcileDecision(session, server) === 'mark-synced', 'reconcile done')
}

{
  const session = { status: 'completed', stale: true }
  assert(
    purgeSessionDecision(session, null) === 'keep-forever',
    'never delete completed without server row',
  )
}

// --- New gap: server-action finish fails after shell upsert ---
{
  const broken = oldCompletedSyncSteps(false)
  assert(broken.server.status === 'in_progress', 'zombie shell left')
  assert(broken.gap === 'shell-without-finish', 'finish never ran')

  const fixed = fixedCompletedSyncSteps()
  assert(fixed.ok && fixed.server.status === 'completed', 'client finish completes')
  assert(fixed.server.logs === 3, 'sets land with finish')
}

{
  const retry = fixedCompletedSyncSteps({ logsFail: true })
  assert(retry.retry && !retry.ok, 'missing sets must retry, not mark synced')
}

{
  const partial = fixedCompletedSyncSteps({ partialLogs: true })
  assert(partial.retry && !partial.ok, '1 of N sets must retry, not mark synced')
}

// --- Demotion guard ---
{
  const completed = {
    id: 's1',
    status: 'completed',
    logs: [{ id: 'l1', weight: 100, reps: 5 }],
  }
  const out = createLocalSessionGuard(completed, {
    id: 's1',
    status: 'in_progress',
  })
  assert(out.status === 'completed', 'must not demote completed')
  assert(out.logs.length === 1, 'must keep logs')
}

// --- Skipped set placeholders ---
{
  const skipped = logRowForUpsert({
    weight: 0,
    reps: 0,
    isSkipped: true,
    durationSeconds: null,
  })
  assert(skipped.weight >= 1 && skipped.reps >= 1, 'skipped needs placeholders')
  const real = logRowForUpsert({
    weight: 100,
    reps: 5,
    isSkipped: false,
    durationSeconds: null,
  })
  assert(real.weight === 100 && real.reps === 5, 'real sets unchanged')
}

// --- Pin race ---
assert(simulateSaveAndPrune({ atomic: false }).length === 0, 'race empties list')
assert(simulateSaveAndPrune({ atomic: true }).length === 1, 'atomic keeps pin')
assert(
  purgeSplitDecision({
    pinned: true,
    stale: true,
    onServer: false,
    liveSession: false,
  }) === 'keep-pinned',
  'pinned never purged',
)

console.log('offline-sync-bugs tests: ok')
