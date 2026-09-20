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
export function toneForFocus(focus?: string | null): AccentTone {
  const key = (focus ?? '').trim().toLowerCase()
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

/** Brand gold CTA — auth / marketing emphasis */
export const CTA_GOLD =
  'btn-pill btn-pill-gold'

/** Selected choice chip — matches fitness profile / settings */
export const CHOICE_SELECTED =
  'border-gold/45 bg-gold-tint text-gold'

export const CHOICE_IDLE =
  'border-border bg-background/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
