#!/usr/bin/env node
/**
 * Static audit: live-only dashboard routes must import OfflineConnectionGate.
 * Run: node scripts/audit-offline-gates.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const gatedRoutes = [
  ['app/dashboard/ai-coach/page.tsx', 'coach'],
  ['app/dashboard/ai-coach/chat/page.tsx', 'coach'],
  ['app/dashboard/ai-coach/activity/page.tsx', 'coach'],
  ['app/dashboard/messages/page.tsx', 'messages'],
  ['app/dashboard/messages/[threadId]/page.tsx', 'messages'],
  ['app/dashboard/messages/groups/[groupId]/page.tsx', 'messages'],
  ['app/dashboard/messages/groups/new/page.tsx', 'messages'],
  ['app/dashboard/leaderboard/page.tsx', 'leaderboard'],
  ['app/dashboard/notifications/page.tsx', 'notifications'],
  ['app/dashboard/home-workouts/page.tsx', 'homeWorkouts'],
  ['app/dashboard/splits/page.tsx', 'splitsManage'],
  ['app/dashboard/splits/recommendations/page.tsx', 'splitsManage'],
  ['app/dashboard/challenges/page.tsx', 'leaderboard'],
]

const clientGuards = [
  ['components/create-split-client.tsx', 'splitRequiresConnection'],
  ['components/split-local-gate.tsx', 'SplitEditGate'],
  ['components/split-edit-offline-guard.tsx', 'SplitEditOfflineGuard'],
  ['components/offline-create-split-link.tsx', 'OfflineCreateSplitLink'],
]

let failed = 0

for (const [rel, feature] of gatedRoutes) {
  const path = join(root, rel)
  if (!existsSync(path)) {
    console.error(`MISSING FILE: ${rel}`)
    failed += 1
    continue
  }
  const src = readFileSync(path, 'utf8')
  if (!src.includes('OfflineConnectionGate')) {
    console.error(`FAIL: ${rel} — missing OfflineConnectionGate`)
    failed += 1
    continue
  }
  if (!src.includes(`feature="${feature}"`) && !src.includes(`feature='${feature}'`)) {
    console.error(`FAIL: ${rel} — expected feature="${feature}"`)
    failed += 1
    continue
  }
  console.log(`OK  ${rel} (${feature})`)
}

for (const [rel, needle] of clientGuards) {
  const path = join(root, rel)
  if (!existsSync(path)) {
    console.error(`MISSING GUARD FILE: ${rel}`)
    failed += 1
    continue
  }
  const src = readFileSync(path, 'utf8')
  if (!src.includes(needle)) {
    console.error(`FAIL: ${rel} — missing ${needle}`)
    failed += 1
    continue
  }
  console.log(`OK  ${rel}`)
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}

console.log('\nAll offline gate checks passed.')
