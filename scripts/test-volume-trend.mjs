import assert from 'node:assert/strict'
import {
  computeWeeklyVolumeTrend,
  formatLoadChangePct,
} from '../lib/volume-trend.ts'

function iso(date) {
  return date.toISOString()
}

const now = new Date('2026-08-30T12:00:00.000Z')

const empty = computeWeeklyVolumeTrend([], now)
assert.equal(empty.loadInsight, 'empty')
assert.equal(empty.bars.length, 8)

const oneSession = computeWeeklyVolumeTrend(
  [{ started_at: iso(now), finished_at: iso(now), total_volume: 1200 }],
  now,
)
assert.equal(oneSession.loadInsight, 'baseline')
assert.equal(oneSession.sessionCount, 1)
assert.ok(oneSession.bars.some((bar) => bar > 4))

const rising = computeWeeklyVolumeTrend(
  [
    {
      started_at: iso(new Date('2026-07-07T10:00:00.000Z')),
      finished_at: iso(new Date('2026-07-07T10:00:00.000Z')),
      total_volume: 1000,
    },
    {
      started_at: iso(new Date('2026-07-14T10:00:00.000Z')),
      finished_at: iso(new Date('2026-07-14T10:00:00.000Z')),
      total_volume: 1000,
    },
    {
      started_at: iso(new Date('2026-08-18T10:00:00.000Z')),
      finished_at: iso(new Date('2026-08-18T10:00:00.000Z')),
      total_volume: 2000,
    },
    {
      started_at: iso(new Date('2026-08-25T10:00:00.000Z')),
      finished_at: iso(new Date('2026-08-25T10:00:00.000Z')),
      total_volume: 2000,
    },
  ],
  now,
)
assert.equal(rising.loadInsight, 'up')
assert.ok((rising.loadChangePct ?? 0) > 0)

assert.equal(formatLoadChangePct(18), '+18%')
assert.equal(formatLoadChangePct(-6), '-6%')

console.log('volume-trend tests passed')
