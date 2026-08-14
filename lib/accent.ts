/** Semantic accent helpers — one bright color per component. */

export type AccentTone = 'amber' | 'blue' | 'green'

export const ACCENT = {
  amber: {
    text: 'text-gold',
    chip: 'border chip-amber',
    badge: 'border badge-amber',
    edge: 'accent-edge-amber',
    softBg: 'bg-gold-tint',
  },
  blue: {
    text: 'text-blue',
    chip: 'border chip-blue',
    badge: 'border badge-blue',
    edge: 'accent-edge-blue',
    softBg: 'bg-blue-tint',
  },
  green: {
    text: 'text-success',
    chip: 'border chip-green',
    badge: 'border badge-green',
    edge: 'accent-edge-green',
    softBg: 'bg-success-tint',
  },
} as const

/** Focus / split category → semantic tone */
export function toneForFocus(focus: string): AccentTone {
  const key = focus.trim().toLowerCase()
  if (key.includes('strength')) return 'blue'
  if (key.includes('athletic') || key.includes('power')) return 'green'
  return 'amber'
}

/** Cycle amber → blue → green for feature grids */
export function toneAt(index: number): AccentTone {
  const order: AccentTone[] = ['amber', 'blue', 'green', 'amber']
  return order[index % order.length]
}

/** Shared primary CTA — chalk fill */
export const CTA_PRIMARY = 'btn-pill btn-pill-primary'

/** Shared secondary outline */
export const CTA_SECONDARY = 'btn-pill btn-pill-secondary'
