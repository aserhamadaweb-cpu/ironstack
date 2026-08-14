'use client'

/**
 * Arm on click → play after the destination route has painted.
 * State lives at module scope so it survives page remounts.
 */

type Listener = (active: boolean) => void

let pending = false
let active = false
let hideTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<Listener>()

export const NAV_TRANSITION_MS = 700

export function isNavTransitionActive() {
  return active
}

export function subscribeNavTransition(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit() {
  for (const listener of listeners) listener(active)
}

/** Mark that the next route change should play the IronStack intro after paint. */
export function armNavTransition() {
  pending = true
}

/** Peek without clearing — safe under React Strict Mode remounts. */
export function isNavTransitionArmed() {
  return pending
}

/** Returns true once if a transition was armed; clears the flag. */
export function consumeArmedNavTransition() {
  if (!pending) return false
  pending = false
  return true
}

export function startNavTransition() {
  active = true
  emit()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    active = false
    hideTimer = null
    emit()
  }, NAV_TRANSITION_MS)
}

/** @deprecated Use armNavTransition + post-paint play instead. */
export function triggerIronStackNavTransition() {
  armNavTransition()
}
