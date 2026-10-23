import type { SplitTemplateId } from './types'

/** Template ids for the fixed ready-made gym programs. */
export const CURATED_TEMPLATE_IDS: readonly SplitTemplateId[] = [
  'ppl_6',
  'arnold',
  'fbeod',
  'pro_split',
  'anterior_posterior',
] as const

export function isCuratedTemplateId(id: string): boolean {
  return (CURATED_TEMPLATE_IDS as readonly string[]).includes(id)
}
