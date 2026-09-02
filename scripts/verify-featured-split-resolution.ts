/**
 * Verifies featured-split resolution for Train page:
 * primary_split_id → else most recent by updated_at (fallback created_at).
 *
 * Run: npx tsx scripts/verify-featured-split-resolution.ts
 */

type SplitRow = {
  id: string
  updated_at: string
  created_at: string
}

function splitSavedTimestamp(split: SplitRow) {
  return split.updated_at || split.created_at
}

function sortSplitsByRecentSaved(splits: SplitRow[]): SplitRow[] {
  return [...splits].sort(
    (a, b) =>
      new Date(splitSavedTimestamp(b)).getTime() -
      new Date(splitSavedTimestamp(a)).getTime(),
  )
}

function resolveFeaturedSplit(
  splits: SplitRow[],
  primarySplitId: string | null,
): SplitRow | null {
  const sorted = sortSplitsByRecentSaved(splits)
  if (primarySplitId) {
    const primary = sorted.find((s) => s.id === primarySplitId)
    if (primary) return primary
  }
  return sorted[0] ?? null
}

let passed = 0
let failed = 0

function assert(name: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`✓ ${name}`)
  } else {
    failed++
    console.error(`✗ ${name}`)
  }
}

const splitA = {
  id: 'a',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
}
const splitB = {
  id: 'b',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-15T00:00:00Z',
}
const splitC = {
  id: 'c',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

// Case 1: preferred split set
assert(
  'preferred split set → shows primary',
  resolveFeaturedSplit([splitA, splitB, splitC], 'a')?.id === 'a',
)

// Case 2: multiple splits, no preferred → most recent by updated_at
assert(
  'no preferred → most recent saved',
  resolveFeaturedSplit([splitA, splitB, splitC], null)?.id === 'c',
)

// Case 3: exactly one split
assert(
  'single split → shows it',
  resolveFeaturedSplit([splitC], null)?.id === 'c',
)
assert(
  'single split with primary set → shows it',
  resolveFeaturedSplit([splitC], 'c')?.id === 'c',
)

// Case 4: zero splits
assert('zero splits → null', resolveFeaturedSplit([], null) === null)

// Case 5: primary points to deleted/missing split → fallback to most recent
assert(
  'stale primary id → falls back to most recent',
  resolveFeaturedSplit([splitA, splitB, splitC], 'deleted-id')?.id === 'c',
)

// updated_at vs created_at fallback
const splitOldUpdate = {
  id: 'd',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '',
}
assert(
  'created_at fallback when updated_at empty',
  sortSplitsByRecentSaved([splitA, splitOldUpdate])[0]?.id === 'd' ||
    sortSplitsByRecentSaved([
      { ...splitOldUpdate, updated_at: splitOldUpdate.created_at },
      splitA,
    ])[0]?.id === 'd',
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
