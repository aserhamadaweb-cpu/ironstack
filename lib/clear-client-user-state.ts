import { THEME_STORAGE_KEY, APPEARANCE_STORAGE_KEY } from '@/lib/theme'
import { LOCALE_STORAGE_KEY } from '@/lib/i18n'
import { UNFINISHED_SESSION_PREF_KEY } from '@/lib/active-workout'
import { clearUnfinishedWorkoutReminder } from '@/lib/active-workout'

const AUTH_USER_KEY = 'ironstack:auth-user-id'
const SESSIONS_KEY = 'ironstack.sessions.v1'
const NAV_AVATAR_KEY = 'ironstack-nav-avatar'

function readAuthUserKey(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(AUTH_USER_KEY)
  } catch {
    return null
  }
}

function writeAuthUserKey(userId: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (userId) window.localStorage.setItem(AUTH_USER_KEY, userId)
    else window.localStorage.removeItem(AUTH_USER_KEY)
  } catch {
    /* ignore */
  }
}

function removeMatchingKeys(
  storage: Storage,
  predicate: (key: string) => boolean,
) {
  const toRemove: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key && predicate(key)) toRemove.push(key)
  }
  for (const key of toRemove) storage.removeItem(key)
}

/** Wipe sync browser caches that are not safely scoped per account. */
export function clearSyncClientCaches(options?: {
  /** Keep light/dark/system + language on this device. Default false on account switch. */
  keepDevicePrefs?: boolean
}) {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem('ironstack:is-guest')
    sessionStorage.removeItem('ironstack:profile-ok')
    sessionStorage.removeItem('ironstack:username-ok')
    sessionStorage.removeItem('ironstack:hub-intro-seen')
    sessionStorage.removeItem(NAV_AVATAR_KEY)
    removeMatchingKeys(
      sessionStorage,
      (key) =>
        key.startsWith('ironstack.split-builder.draft.') ||
        key.startsWith('ironstack:'),
    )
  } catch {
    /* ignore */
  }

  try {
    localStorage.removeItem(SESSIONS_KEY)
    localStorage.removeItem(UNFINISHED_SESSION_PREF_KEY)
    removeMatchingKeys(
      localStorage,
      (key) =>
        key === SESSIONS_KEY ||
        key.startsWith(`${SESSIONS_KEY}.`) ||
        key.startsWith('ironstack.sessions'),
    )
    // Never remove AUTH_USER_KEY here — handleAuthUserChanged owns that.
    if (!options?.keepDevicePrefs) {
      localStorage.removeItem(THEME_STORAGE_KEY)
      localStorage.removeItem(APPEARANCE_STORAGE_KEY)
      localStorage.removeItem(LOCALE_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }

  clearUnfinishedWorkoutReminder()
}

/**
 * Drop IndexedDB rows that belong to another account (keep exercise catalog
 * + system splits).
 */
export async function resetOfflineDataForAccountSwitch(
  nextUserId: string | null,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  try {
    const { getOfflineDb } = await import('@/lib/offline/db')
    const db = await getOfflineDb()

    const sessions = await db.getAll('sessions')
    for (const session of sessions) {
      if (!nextUserId || session.userId !== nextUserId) {
        await db.delete('sessions', session.id)
      }
    }

    await db.clear('personalRecords')
    await db.clear('splitMutations')

    const splits = await db.getAll('splits')
    for (const split of splits) {
      if (!split.row?.is_system) {
        await db.delete('splits', split.id)
      }
    }

    await db.delete('meta', 'homeSnapshot')
    await db.delete('meta', 'deletedSplitIds')
    await db.delete('meta', 'orphanPurgeNotice')
    await db.delete('meta', 'workoutCachedAt')

    if (nextUserId) {
      await db.put('meta', nextUserId, 'userId')
    } else {
      await db.delete('meta', 'userId')
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ironstack-offline-changed'))
    }
  } catch {
    /* IndexedDB may be blocked — sync caches still cleared above */
  }
}

/**
 * Call on sign-out / sign-in / sign-up when the authenticated user id changes.
 * Idempotent when the same user refreshes.
 */
export async function handleAuthUserChanged(
  nextUserId: string | null,
  options?: { keepDevicePrefs?: boolean },
): Promise<void> {
  if (typeof window === 'undefined') return

  const previous = readAuthUserKey()
  const next = nextUserId ?? ''
  const prev = previous ?? ''
  if (prev === next) return

  // First session on this device — persist the user id without wiping offline data.
  if (!previous) {
    writeAuthUserKey(nextUserId)
    return
  }

  clearSyncClientCaches({
    keepDevicePrefs: options?.keepDevicePrefs === true && Boolean(nextUserId),
  })
  await resetOfflineDataForAccountSwitch(nextUserId)
  writeAuthUserKey(nextUserId)
}

export function readStoredAuthUserId(): string | null {
  return readAuthUserKey()
}
