'use client'

/** How long after a route change we treat navigation as user-intentional. */
const RECENT_NAV_MS = 8_000

/**
 * `offline` must persist this long before UI switches to offline treatment —
 * flaky mobile links report offline for a moment and recover.
 */
export const OFFLINE_SETTLE_MS = 2_000

/**
 * `push` / `replace` / `traverse` come from the Next router (every Link,
 * router.push/replace, back/forward). `document` is a full page load (plain
 * anchor, location.assign, Retry). `route` is a committed pathname.
 */
export type NavigationSource = 'push' | 'replace' | 'traverse' | 'document' | 'route'

let lastIntentAt = 0
let intendedPath: string | null = null
/** Soft/full navigations that have not painted their destination yet. */
let navInFlight = false
let inFlightPath: string | null = null

type IntentListener = (path: string, source: NavigationSource) => void
const listeners = new Set<IntentListener>()

const IN_FLIGHT_SOURCES: NavigationSource[] = ['push', 'replace', 'document']

/** Record that the user (or router) moved to a route intentionally. */
export function markNavigationIntent(path?: string, source: NavigationSource = 'route') {
  lastIntentAt = Date.now()
  if (IN_FLIGHT_SOURCES.includes(source)) {
    navInFlight = true
    inFlightPath = path ?? null
  }
  if (path) {
    intendedPath = path
    for (const listener of listeners) {
      try {
        listener(path, source)
      } catch {
        /* ignore subscriber errors */
      }
    }
  }
}

/** True while a push/replace/document nav is unfinished or a loading.tsx is up. */
export function isNavigationInFlight() {
  return navInFlight || routeLoadingCount > 0
}

export function getInFlightPath() {
  return inFlightPath
}

/** Drop a false start (same-URL tap) so reconnect refresh is not blocked forever. */
export function clearNavigationInFlight() {
  navInFlight = false
  inFlightPath = null
}

/**
 * Full page load that still gets the slow-connection overlay. An installed PWA
 * window shows no browser loading indicator for these.
 */
export function hardNavigate(href: string, options?: { replace?: boolean }) {
  markNavigationIntent(href, 'document')
  if (options?.replace) window.location.replace(href)
  else window.location.assign(href)
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

/**
 * Route-level loading boundaries (`loading.tsx`) currently on screen. A
 * prefetched navigation commits the URL before its content streams in, so the
 * URL alone cannot tell us the destination actually rendered.
 */
let routeLoadingCount = 0
const routeLoadingListeners = new Set<(count: number) => void>()

function emitRouteLoading() {
  for (const listener of routeLoadingListeners) {
    try {
      listener(routeLoadingCount)
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/** Register a mounted loading boundary; call the returned function on unmount. */
export function trackRouteLoading(): () => void {
  routeLoadingCount += 1
  emitRouteLoading()
  let released = false
  return () => {
    if (released) return
    released = true
    routeLoadingCount = Math.max(0, routeLoadingCount - 1)
    emitRouteLoading()
  }
}

export function isRouteLoading() {
  return routeLoadingCount > 0
}

export function subscribeRouteLoading(listener: (count: number) => void): () => void {
  routeLoadingListeners.add(listener)
  return () => {
    routeLoadingListeners.delete(listener)
  }
}

/** A tracked navigation finished (`done`) or the user gave up on it (`abandoned`). */
export type NavigationOutcome = 'done' | 'abandoned'
const settledListeners = new Set<(outcome: NavigationOutcome, path: string) => void>()

export function notifyNavigationSettled(outcome: NavigationOutcome, path: string) {
  navInFlight = false
  inFlightPath = null
  for (const listener of settledListeners) {
    try {
      listener(outcome, path)
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeNavigationSettled(
  listener: (outcome: NavigationOutcome, path: string) => void,
): () => void {
  settledListeners.add(listener)
  return () => {
    settledListeners.delete(listener)
  }
}

/**
 * While the guided tour owns the screen, suppress the global slow-nav overlay —
 * tour already shows its own between-step chrome and the double UI feels laggy.
 */
let tourNavSuppressed = false

export function setTourNavigationActive(active: boolean) {
  tourNavSuppressed = active
}

export function isTourNavigationActive() {
  return tourNavSuppressed
}
