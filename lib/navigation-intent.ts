'use client'

/** How long after a route change we treat navigation as user-intentional. */
const RECENT_NAV_MS = 8_000

let lastIntentAt = 0
let intendedPath: string | null = null

type IntentListener = (path: string) => void
const listeners = new Set<IntentListener>()

/** Record that the user (or router) moved to a route intentionally. */
export function markNavigationIntent(path?: string) {
  lastIntentAt = Date.now()
  if (path) {
    intendedPath = path
    for (const listener of listeners) {
      try {
        listener(path)
      } catch {
        /* ignore subscriber errors */
      }
    }
  }
}

export function hasRecentNavigationIntent(withinMs = RECENT_NAV_MS) {
  return Date.now() - lastIntentAt < withinMs
}

export function getIntendedPath() {
  return intendedPath
}

/** Subscribe to intentional navigations (for slow-connection progress UI). */
export function subscribeNavigationIntent(listener: IntentListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
