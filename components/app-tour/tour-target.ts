export type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

export function isTourTargetCandidate(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number(style.opacity) === 0
  ) {
    return false
  }
  const rect = el.getBoundingClientRect()
  if (rect.width < 4 && rect.height < 4) return false
  const sidebar = el.closest('.app-sidebar')
  if (sidebar instanceof HTMLElement && !sidebar.classList.contains('is-open')) {
    return false
  }
  return true
}

/**
 * Resolves a tour spotlight target.
 * Comma-separated selectors are tried left-to-right (preference order),
 * so empty-account fallbacks like offline-toggle → workout-splits work.
 */
export function findTourTarget(selector?: string): HTMLElement | null {
  if (!selector || typeof document === 'undefined') return null
  const parts = selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const ordered = parts.length > 0 ? parts : [selector]
  for (const part of ordered) {
    const nodes = document.querySelectorAll(part)
    for (const node of nodes) {
      if (node instanceof HTMLElement && isTourTargetCandidate(node)) {
        return node
      }
    }
  }
  return null
}

export function rectFromElement(el: HTMLElement, pad = 8): SpotlightRect {
  const rect = el.getBoundingClientRect()
  const iconSpotlight = el.getAttribute('data-tour-spotlight') === 'icon'

  if (iconSpotlight) {
    const size = Math.max(rect.width, rect.height) + pad * 2
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let left = cx - size / 2
    let top = cy - size / 2
    left = Math.max(8, Math.min(left, window.innerWidth - size - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - size - 8))
    return {
      top,
      left,
      width: Math.min(size, window.innerWidth - 16),
      height: Math.min(size, window.innerHeight - 16),
    }
  }

  const fullBleed =
    rect.left <= 1 && rect.width >= window.innerWidth - 2

  let top: number
  let left: number
  let width: number
  let height: number

  if (fullBleed) {
    const edgePad = 4
    top = Math.max(edgePad, rect.top - pad)
    left = edgePad
    width = window.innerWidth - edgePad * 2
    height = Math.min(window.innerHeight - edgePad * 2, rect.height + pad * 2)
  } else {
    top = Math.max(8, rect.top - pad)
    left = Math.max(8, rect.left - pad)
    width = Math.min(window.innerWidth - 16, rect.width + pad * 2)
    height = Math.min(window.innerHeight - 16, rect.height + pad * 2)
  }

  const maxHeight = Math.floor(window.innerHeight * 0.42)
  if (height > maxHeight) {
    height = maxHeight
  }

  return { top, left, width, height }
}

export function spotlightCenter(spot: SpotlightRect) {
  return {
    x: spot.left + spot.width / 2,
    y: spot.top + spot.height / 2,
  }
}

export type TooltipPlacement = 'top' | 'bottom'

const TOOLTIP_GAP = 12
const VIEWPORT_MARGIN = 12
const TOOLTIP_WIDTH = 280
const TOOLTIP_EST_HEIGHT = 148
/** Viewport band reserved for fixed tab bar + safe area. */
const BOTTOM_ANCHOR_THRESHOLD = 80

export function computeCoachMarkTooltipStyle(
  spot: SpotlightRect,
  viewportWidth: number,
  viewportHeight: number,
): {
  placement: TooltipPlacement
  style: { top: number; left: number; width: number }
} {
  const width = Math.min(TOOLTIP_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2)
  const centerX = spot.left + spot.width / 2
  let left = centerX - width / 2
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, viewportWidth - width - VIEWPORT_MARGIN),
  )

  const spotBottom = spot.top + spot.height
  const isBottomAnchored = spotBottom >= viewportHeight - BOTTOM_ANCHOR_THRESHOLD

  const spaceAbove = spot.top - VIEWPORT_MARGIN
  const spaceBelow = viewportHeight - spotBottom - VIEWPORT_MARGIN
  const fitsAbove = spaceAbove >= TOOLTIP_EST_HEIGHT + TOOLTIP_GAP
  const fitsBelow = spaceBelow >= TOOLTIP_EST_HEIGHT + TOOLTIP_GAP

  let placement: TooltipPlacement = 'bottom'

  if (isBottomAnchored || (fitsAbove && !fitsBelow)) {
    placement = 'top'
  } else if (fitsAbove && fitsBelow) {
    placement = spaceAbove >= spaceBelow ? 'top' : 'bottom'
  } else if (!fitsBelow && fitsAbove) {
    placement = 'top'
  }

  let top =
    placement === 'top'
      ? spot.top - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT
      : spotBottom + TOOLTIP_GAP

  if (placement === 'top') {
    top = Math.max(VIEWPORT_MARGIN, top)
    // Guarantee gap between tooltip bottom and spotlight top.
    const tooltipBottom = top + TOOLTIP_EST_HEIGHT
    if (tooltipBottom + TOOLTIP_GAP > spot.top) {
      top = Math.max(VIEWPORT_MARGIN, spot.top - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT)
    }
  } else {
    top = Math.min(
      viewportHeight - TOOLTIP_EST_HEIGHT - VIEWPORT_MARGIN,
      top,
    )
  }

  return { placement, style: { top, left, width } }
}

export function coachMarkScrollReservePx() {
  return TOOLTIP_EST_HEIGHT + TOOLTIP_GAP + 24
}

/** Fast poll while the route paints; ~3s total before target-missed fallback. */
export const TOUR_TARGET_POLL_INTERVAL_MS = 50
export const TOUR_TARGET_POLL_MAX_ATTEMPTS = 60
