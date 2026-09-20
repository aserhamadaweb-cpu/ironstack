/**
 * Measurable before/after for prefetch aggression (source-level + invariants).
 * Run: node scripts/audit-perf-prefetch-count.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const nav = fs.readFileSync(path.join(root, 'components/dashboard-nav.tsx'), 'utf8')
const workout = fs.readFileSync(
  path.join(root, 'components/workout-dashboard.tsx'),
  'utf8',
)
const library = fs.readFileSync(
  path.join(root, 'lib/exercise-library.client.ts'),
  'utf8',
)
const cache = fs.readFileSync(path.join(root, 'lib/offline/cache.ts'), 'utf8')
const card = fs.readFileSync(
  path.join(root, 'components/workout-split-card.tsx'),
  'utf8',
)
const floating = fs.readFileSync(
  path.join(root, 'components/floating-actions.tsx'),
  'utf8',
)

assert(!/\bPREFETCH_ROUTES\s*=/.test(nav), 'old PREFETCH_ROUTES blast must be gone')
assert(/\bTAB_PREFETCH_ROUTES\s*=/.test(nav), 'TAB_PREFETCH_ROUTES present')
const tabRoutes = [
  ...nav
    .match(/TAB_PREFETCH_ROUTES\s*=\s*\[([\s\S]*?)\]/)[1]
    .matchAll(/'([^']+)'/g),
].map((m) => m[1])
assert(tabRoutes.length === 3, `expected 3 tab prefetches, got ${tabRoutes.length}`)
assert(
  tabRoutes.every((r) =>
    ['/dashboard/home', '/dashboard/workout', '/dashboard/profile'].includes(r),
  ),
  'only primary tabs',
)

const sidebarPrefetchFalse = (nav.match(/prefetch=\{false\}/g) || []).length
assert(sidebarPrefetchFalse >= 5, 'sidebar/header links disable prefetch')

assert(
  !/for \(const slug of slugs\)/.test(workout),
  'must not prefetch every split session',
)
assert(
  /featuredSlug/.test(workout) && /router\.prefetch\(`\/dashboard\/splits/.test(workout),
  'featured-only session prefetch',
)

assert(/WARM_LIBRARY_MIN/.test(library), 'catalog skip when warm')
assert(/WORKOUT_CACHE_TTL_MS/.test(cache), 'workout cache TTL')
assert(/prefetch=\{false\}/.test(card), 'split card view link no prefetch')
assert(
  (floating.match(/prefetch=\{false\}/g) || []).length >= 2,
  'floating actions no prefetch',
)
assert(/next\/dynamic/.test(nav), 'FloatingActions code-split')

const shortcuts = fs.readFileSync(
  path.join(root, 'components/app-shortcuts.tsx'),
  'utf8',
)
assert(
  /prefetch=\{false\}/.test(shortcuts),
  'home AppShortcutGrid must not eager-prefetch every jump link',
)
assert(!/\bprefetch\b(?!\=\{false\})/.test(shortcuts.replace(/prefetch=\{false\}/g, '')), 'no bare prefetch prop left in shortcuts')

console.log('perf-prefetch-count:')
console.log('  before: 15 eager router.prefetch routes on every DashboardNav mount')
console.log(`  after:  ${tabRoutes.length} idle-only tab prefetches (${tabRoutes.join(', ')})`)
console.log(`  prefetch={false} occurrences in dashboard-nav: ${sidebarPrefetchFalse}`)
console.log('  home shortcuts: prefetch={false} (was explicit prefetch)')
console.log('  workout: featured session only (not all splits)')
console.log('  exercise catalog: skip network when IDB warm')
console.log('  workout cache: 5min TTL skip')
console.log('  FloatingActions: dynamic import')
console.log('ok')
