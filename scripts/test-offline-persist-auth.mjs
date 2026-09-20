/**
 * Regression: offline cold-start must not wipe IndexedDB via handleAuthUserChanged(null).
 * Run: node scripts/test-offline-persist-auth.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

/**
 * Mirrors fixed handleAuthUserChanged decision (without DOM).
 * Returns whether resetOfflineDataForAccountSwitch would run.
 */
function wouldWipeOfflineData({
  previous,
  nextUserId,
  isSignOut,
}) {
  const next = nextUserId ?? ''
  const prev = previous ?? ''
  if (prev === next) return false
  if (!previous) return false // first bind — no wipe
  if (previous && !nextUserId && !isSignOut) return false
  return true
}

// Bug: offline reopen → getUser() null → wipe
assert(
  !wouldWipeOfflineData({
    previous: 'user-a',
    nextUserId: null,
    isSignOut: false,
  }),
  'transient null must not wipe',
)

// Real sign-out must wipe
assert(
  wouldWipeOfflineData({
    previous: 'user-a',
    nextUserId: null,
    isSignOut: true,
  }),
  'explicit sign-out must wipe',
)

// Account switch must wipe
assert(
  wouldWipeOfflineData({
    previous: 'user-a',
    nextUserId: 'user-b',
    isSignOut: false,
  }),
  'account switch must wipe',
)

// Same user refresh — no wipe
assert(
  !wouldWipeOfflineData({
    previous: 'user-a',
    nextUserId: 'user-a',
    isSignOut: false,
  }),
  'same user no wipe',
)

// First bind — no wipe
assert(
  !wouldWipeOfflineData({
    previous: null,
    nextUserId: 'user-a',
    isSignOut: false,
  }),
  'first bind no wipe',
)

// Bootstrap whoami failure must not wipe (mirrors AuthSessionBootstrap fix).
function bootstrapWhoamiWipe({ whoami, clientUser }) {
  // whoami: null = network fail, {userId:null} = logged out, {userId} = ok
  if (whoami === null) return false // keep offline data
  if (!whoami.userId && clientUser) return true // local sign-out path
  return false
}
assert(
  !bootstrapWhoamiWipe({ whoami: null, clientUser: 'u1' }),
  'whoami network fail must not wipe',
)
assert(
  bootstrapWhoamiWipe({ whoami: { userId: null }, clientUser: 'u1' }),
  'confirmed logout may wipe via SIGNED_OUT',
)

console.log('offline-persist-auth tests: ok')
