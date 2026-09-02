#!/usr/bin/env node
/**
 * Unit checks for offline user-split filtering (no browser/IDB).
 * Run: node scripts/test-offline-split-picker.mjs
 */

function filterCachedUserSplits(rows, userId) {
  if (!userId) return []
  return rows
    .filter((row) => row.row.user_id === userId && !row.row.is_system)
    .map((row) => ({
      id: row.id,
      slug: row.detail.slug,
      name: row.detail.name,
      days: row.detail.daysPerWeek,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

const USER = 'user-aaa'

function mockRow(id, name, userId, isSystem, days = 4) {
  return {
    id,
    detail: { slug: id, name, daysPerWeek: days },
    row: { user_id: userId, is_system: isSystem },
  }
}

const rows = [
  mockRow('sys-ppl', 'Push / Pull / Legs', null, true, 6),
  mockRow('sys-upper', 'Upper / Lower', null, true, 4),
  mockRow('sys-full', 'Full Body', null, true, 3),
  mockRow('sys-bro', 'Bro Split', null, true, 5),
  mockRow('mine-1', 'My Hypertrophy', USER, false, 5),
  mockRow('mine-2', 'Home Push', USER, false, 3),
  mockRow('other', 'Someone Else', 'user-bbb', false, 4),
]

const userSplits = filterCachedUserSplits(rows, USER)

let failed = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failed += 1
  } else {
    console.log(`OK  ${message}`)
  }
}

assert(userSplits.length === 2, 'multiple cached user splits → count 2')
assert(
  userSplits.every((s) => s.slug === 'mine-1' || s.slug === 'mine-2'),
  'only owned non-system splits returned',
)
assert(
  !userSplits.some((s) => s.name.includes('Push / Pull')),
  'system Push / Pull / Legs excluded',
)
assert(
  !userSplits.some((s) => s.name.includes('Full Body')),
  'system Full Body excluded',
)
assert(
  !userSplits.some((s) => s.name.includes('Bro Split')),
  'system Bro Split excluded',
)

const one = filterCachedUserSplits([mockRow('mine-1', 'My Hypertrophy', USER, false)], USER)
assert(one.length === 1, 'exactly one cached split → count 1')
assert(one[0].slug === 'mine-1', 'single split slug preserved')

const zero = filterCachedUserSplits(rows, `${USER}-no-splits`)
assert(zero.length === 0, 'zero cached user splits → empty array')

const zeroNoUser = filterCachedUserSplits(rows, null)
assert(zeroNoUser.length === 0, 'missing user id → empty array')

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}

console.log('\nAll offline split picker checks passed.')
