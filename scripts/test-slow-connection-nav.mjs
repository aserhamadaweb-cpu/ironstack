/**
 * Logic tests for slow-connection navigation UX (no silent bounce).
 * Run: node scripts/test-slow-connection-nav.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function normalizePath(path) {
  const bare = path.split('#')[0]?.split('?')[0] ?? path
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1)
  return bare || '/'
}

function pathsMatch(current, target) {
  const a = normalizePath(current)
  const b = normalizePath(target)
  return a === b || a.startsWith(`${b}/`)
}

/** Mirrors NavigationProgress phase machine. */
function phaseAt(elapsedMs, { pathnameChanged }) {
  if (pathnameChanged) return 'idle'
  if (elapsedMs >= 18_000) return 'failed'
  if (elapsedMs >= 4_000) return 'slow'
  if (elapsedMs >= 280) return 'pending'
  return 'idle'
}

assert(phaseAt(100, { pathnameChanged: false }) === 'idle', 'no flicker')
assert(phaseAt(500, { pathnameChanged: false }) === 'pending', 'show loading')
assert(phaseAt(5_000, { pathnameChanged: false }) === 'slow', 'slow copy')
assert(phaseAt(20_000, { pathnameChanged: false }) === 'failed', 'failed + retry')
assert(phaseAt(20_000, { pathnameChanged: true }) === 'idle', 'success clears')

assert(pathsMatch('/dashboard/messages', '/dashboard/messages'), 'exact')
assert(pathsMatch('/dashboard/messages/abc', '/dashboard/messages'), 'child ok')
assert(!pathsMatch('/dashboard/home', '/dashboard/workout'), 'different')

/** Offline shell: only auto-redirect after true offline→online. */
function offlineShellMode({ navigatorOnline, wasOffline }) {
  if (!navigatorOnline) return 'floor'
  if (!wasOffline) return 'flaky-retry-ui'
  return 'reconnecting-auto'
}
assert(
  offlineShellMode({ navigatorOnline: true, wasOffline: false }) ===
    'flaky-retry-ui',
  'online /offline must not silent bounce',
)
assert(
  offlineShellMode({ navigatorOnline: false, wasOffline: false }) === 'floor',
  'true offline floor',
)
assert(
  offlineShellMode({ navigatorOnline: true, wasOffline: true }) ===
    'reconnecting-auto',
  'recover after offline',
)

console.log('slow-connection-nav tests: ok')
