/**
 * Concurrent finish/PR sync race:
 * Two overlapping demote→insert paths can leave multiple is_current_pr=true
 * rows for the same lift (no DB unique constraint).
 *
 * Mirrors applySessionPersonalRecords decision logic (pure) + a fake store
 * that runs two writers concurrently.
 *
 * Run: node scripts/test-pr-concurrent-sync.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

/** Old buggy path: always demote + insert (no read/match/cleanup). */
async function buggyApplyPr(store, userId, liftTypeId, weight, reps) {
  for (const row of store) {
    if (
      row.user_id === userId &&
      row.lift_type_id === liftTypeId &&
      row.is_current_pr
    ) {
      row.is_current_pr = false
    }
  }
  // Yield so a concurrent writer can interleave after demote.
  await Promise.resolve()
  store.push({
    id: `pr-${store.length + 1}-${Math.random().toString(16).slice(2, 6)}`,
    user_id: userId,
    lift_type_id: liftTypeId,
    weight,
    reps,
    is_current_pr: true,
  })
}

/**
 * Fixed path (same decisions as applySessionPersonalRecords).
 * @param {{yieldAfterDemote?: boolean}} opts
 */
async function fixedApplyPr(store, userId, liftTypeId, weight, reps, opts = {}) {
  const currents = store.filter(
    (row) =>
      row.user_id === userId &&
      row.lift_type_id === liftTypeId &&
      row.is_current_pr,
  )
  const match = currents.find(
    (row) => Number(row.weight) === Number(weight) && Number(row.reps) === Number(reps),
  )
  if (match) {
    for (const row of currents) {
      if (row.id !== match.id) row.is_current_pr = false
    }
    return { skipped: true }
  }

  for (const row of currents) row.is_current_pr = false
  if (opts.yieldAfterDemote) await Promise.resolve()

  const inserted = {
    id: `pr-${store.length + 1}-${Math.random().toString(16).slice(2, 6)}`,
    user_id: userId,
    lift_type_id: liftTypeId,
    weight,
    reps,
    is_current_pr: true,
  }
  store.push(inserted)

  // Race cleanup: demote any other currents that appeared concurrently.
  for (const row of store) {
    if (
      row.user_id === userId &&
      row.lift_type_id === liftTypeId &&
      row.is_current_pr &&
      row.id !== inserted.id
    ) {
      row.is_current_pr = false
    }
  }
  return { skipped: false, id: inserted.id }
}

function currentCount(store, userId, liftTypeId) {
  return store.filter(
    (row) =>
      row.user_id === userId &&
      row.lift_type_id === liftTypeId &&
      row.is_current_pr,
  ).length
}

async function main() {
  const userId = 'user-1'
  const liftTypeId = 'lift-bench'

  // --- Reproduce buggy concurrent finish ---
  const buggyStore = [
    {
      id: 'old',
      user_id: userId,
      lift_type_id: liftTypeId,
      weight: 100,
      reps: 5,
      is_current_pr: true,
    },
  ]
  await Promise.all([
    buggyApplyPr(buggyStore, userId, liftTypeId, 110, 3),
    buggyApplyPr(buggyStore, userId, liftTypeId, 110, 3),
  ])
  const buggyCurrents = currentCount(buggyStore, userId, liftTypeId)
  assert(
    buggyCurrents === 2,
    `expected buggy race to leave 2 current PRs, got ${buggyCurrents}`,
  )
  console.log('repro: concurrent demote+insert left', buggyCurrents, 'current PRs')

  // --- Fixed path under the same interleaving ---
  const fixedStore = [
    {
      id: 'old',
      user_id: userId,
      lift_type_id: liftTypeId,
      weight: 100,
      reps: 5,
      is_current_pr: true,
    },
  ]
  await Promise.all([
    fixedApplyPr(fixedStore, userId, liftTypeId, 110, 3, {
      yieldAfterDemote: true,
    }),
    fixedApplyPr(fixedStore, userId, liftTypeId, 110, 3, {
      yieldAfterDemote: true,
    }),
  ])
  const fixedCurrents = currentCount(fixedStore, userId, liftTypeId)
  assert(
    fixedCurrents === 1,
    `fixed concurrent apply must leave exactly 1 current PR, got ${fixedCurrents}`,
  )
  const winner = fixedStore.find((r) => r.is_current_pr)
  assert(winner && Number(winner.weight) === 110 && Number(winner.reps) === 3, 'winner values')
  console.log('fixed: concurrent apply left', fixedCurrents, 'current PR')

  // --- Retry / already-completed heal: matching current is skipped, extras cleaned ---
  const healStore = [
    {
      id: 'a',
      user_id: userId,
      lift_type_id: liftTypeId,
      weight: 110,
      reps: 3,
      is_current_pr: true,
    },
    {
      id: 'b',
      user_id: userId,
      lift_type_id: liftTypeId,
      weight: 110,
      reps: 3,
      is_current_pr: true,
    },
  ]
  const heal = await fixedApplyPr(healStore, userId, liftTypeId, 110, 3)
  assert(heal.skipped === true, 'matching current should skip insert')
  assert(
    currentCount(healStore, userId, liftTypeId) === 1,
    'extras demoted on skip path',
  )
  console.log('fixed: matching retry cleans duplicate currents')

  console.log('pr-concurrent-sync tests: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
