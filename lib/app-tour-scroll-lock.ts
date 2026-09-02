import {
  APP_TOUR_CLOSE_SIDEBAR_EVENT,
  APP_TOUR_END_EVENT,
} from '@/lib/app-tour'

type TourLockWindow = Window & {
  __ironstackTourScrollAbort?: AbortController
}

let lockedScrollY = 0

/** Drop tour/menu scroll locks. Safe to call multiple times. */
export function releaseAppScrollLock(): void {
  if (typeof document === 'undefined') return

  const w = window as TourLockWindow
  w.__ironstackTourScrollAbort?.abort()
  w.__ironstackTourScrollAbort = undefined

  const html = document.documentElement
  const body = document.body
  html.classList.remove('tour-scroll-lock')
  body.classList.remove('tour-lock')
  body.classList.remove('nav-menu-scroll-lock')
  html.style.removeProperty('overflow')
  body.style.removeProperty('overflow')
  body.style.removeProperty('touch-action')
  html.style.removeProperty('position')
  body.style.removeProperty('position')
  html.style.removeProperty('height')
  body.style.removeProperty('height')
  body.style.removeProperty('top')
  body.style.removeProperty('width')

  // Close menu before END so the fixed nav scrim cannot keep intercepting wheel events.
  window.dispatchEvent(new CustomEvent(APP_TOUR_CLOSE_SIDEBAR_EVENT))
  window.dispatchEvent(new CustomEvent(APP_TOUR_END_EVENT))

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

  // Safari/iOS can keep the viewport stuck after overflow:hidden — force restore.
  window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'auto' })
  requestAnimationFrame(() => {
    const maxScroll = html.scrollHeight - html.clientHeight
    if (maxScroll <= 2) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } else if (window.scrollY > maxScroll) {
      window.scrollTo({ top: maxScroll, left: 0, behavior: 'auto' })
    }
  })
}

/** While the tour overlay is mounted — CSS class only (no wheel/touchmove traps). */
export function lockTourScroll(): void {
  if (typeof document === 'undefined') return
  lockedScrollY = window.scrollY
  document.documentElement.classList.add('tour-scroll-lock')
}

export function registerTourKeydownTrap(onEscape: () => void): AbortController {
  const ac = new AbortController()
  const w = window as TourLockWindow
  w.__ironstackTourScrollAbort?.abort()
  w.__ironstackTourScrollAbort = ac

  const blockKeys = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onEscape()
    }
  }

  window.addEventListener('keydown', blockKeys, {
    capture: true,
    signal: ac.signal,
  })

  return ac
}

export function unregisterTourKeydownTrap(ac: AbortController): void {
  ac.abort()
  const w = window as TourLockWindow
  if (w.__ironstackTourScrollAbort === ac) {
    w.__ironstackTourScrollAbort = undefined
  }
  releaseAppScrollLock()
}
