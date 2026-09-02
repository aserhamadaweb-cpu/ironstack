'use client'

/** How long after a route change we treat navigation as user-intentional. */
const RECENT_NAV_MS = 4_000

let lastIntentAt = 0
let intendedPath: string | null = null

/** Record that the user (or router) moved to a route intentionally. */
export function markNavigationIntent(path?: string) {
  lastIntentAt = Date.now()
  if (path) intendedPath = path
}

export function hasRecentNavigationIntent(withinMs = RECENT_NAV_MS) {
  return Date.now() - lastIntentAt < withinMs
}

export function getIntendedPath() {
  return intendedPath
}
