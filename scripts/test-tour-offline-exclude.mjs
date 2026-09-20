/**
 * Tour offline-exclusion rules (mirrors AppTourProvider helpers).
 * Run: node scripts/test-tour-offline-exclude.mjs
 */

function isOfflineShellPath(pathname) {
  return pathname === '/offline' || pathname.startsWith('/offline/')
}

function shouldBlockTourAutoOffer(online, pathname) {
  if (!online) return true
  if (isOfflineShellPath(pathname)) return true
  return false
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(shouldBlockTourAutoOffer(false, '/dashboard/home'), 'offline home blocked')
assert(shouldBlockTourAutoOffer(false, '/dashboard/workout'), 'offline workout blocked')
assert(shouldBlockTourAutoOffer(true, '/offline'), '/offline shell blocked')
assert(shouldBlockTourAutoOffer(true, '/offline/foo'), '/offline/* blocked')
assert(!shouldBlockTourAutoOffer(true, '/dashboard/home'), 'online home allowed')
assert(!shouldBlockTourAutoOffer(true, '/dashboard/workout'), 'online workout allowed')

/** Deferred banner reason must not claim active session for wrong-route. */
function deferredCopyKey(reason) {
  return reason === 'active-session' ? 'deferredBody' : 'deferredRouteBody'
}
assert(deferredCopyKey('wrong-route') === 'deferredRouteBody', 'wrong-route copy')
assert(deferredCopyKey('active-session') === 'deferredBody', 'active-session copy')

console.log('tour-offline-exclude tests: ok')
