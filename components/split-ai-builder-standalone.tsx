'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'
import { SplitRecommendationAiBuilder } from '@/components/split-recommendation-ai-builder'

export function SplitAiBuilderStandalone() {
  const t = useTranslations('splitRecommendations')
  const [savedNotice, setSavedNotice] = useState(false)
  const [savedProgramName, setSavedProgramName] = useState<string | null>(null)

  function handleSaved(_splitId: string, programName?: string) {
    setSavedNotice(true)
    setSavedProgramName(programName ?? null)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-5">
      {savedNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-gold/45 bg-gold/10 px-4 py-4 sm:px-5"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-gold"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-base font-bold text-foreground">
                {t('savedBannerTitle')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {savedProgramName
                  ? t('savedBannerBodyNamed', { name: savedProgramName })
                  : t('savedToSplits')}
              </p>
              <Link
                href="/dashboard/splits"
                className="mt-3 inline-flex min-h-11 items-center text-xs font-bold tracking-[0.12em] text-gold transition hover:text-gold/80"
              >
                {t('viewYourSplits')} →
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <SplitRecommendationAiBuilder defaultOpen onSaved={handleSaved} />
    </div>
  )
}
