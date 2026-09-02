'use client'

import { useTranslations } from 'next-intl'
import type { AppTourStepDef, AppTourStepId } from '@/lib/app-tour'

export function TourCoachMarkContent({ step }: { step: AppTourStepDef }) {
  const t = useTranslations('tour')
  const id = step.id as AppTourStepId
  const prefix = `steps.${id}`
  const title = t(`${prefix}.title`)
  const leadKey = `${prefix}.leadCoachMark`
  const lead = t.has(leadKey) ? t(leadKey) : t(`${prefix}.lead`)

  return (
    <div className="min-w-0">
      <h2 className="font-heading text-sm font-bold leading-snug text-foreground">
        {title}
      </h2>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {lead}
      </p>
    </div>
  )
}
