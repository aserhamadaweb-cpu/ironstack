'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SplitRecommendationAiBuilder } from '@/components/split-recommendation-ai-builder'
import {
  ActionFeedbackBanner,
  useActionFeedback,
} from '@/components/action-feedback'

export function SplitAiBuilderStandalone() {
  const t = useTranslations('splitRecommendations')
  const { notifySuccess } = useActionFeedback()
  const [savedNotice, setSavedNotice] = useState(false)
  const [savedProgramName, setSavedProgramName] = useState<string | null>(null)

  function handleSaved(_splitId: string, programName?: string) {
    setSavedNotice(true)
    setSavedProgramName(programName ?? null)
    notifySuccess(
      programName
        ? t('savedBannerBodyNamed', { name: programName })
        : t('savedToSplits'),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <SplitRecommendationAiBuilder defaultOpen onSaved={handleSaved} />
      {savedNotice ? (
        <div className="space-y-3">
          <ActionFeedbackBanner
            success={
              savedProgramName
                ? t('savedBannerBodyNamed', { name: savedProgramName })
                : t('savedToSplits')
            }
          />
          <Link
            href="/dashboard/splits"
            className="inline-flex min-h-11 items-center text-xs font-bold tracking-[0.12em] text-gold transition hover:text-gold/80"
          >
            {t('viewYourSplits')} →
          </Link>
        </div>
      ) : null}
    </div>
  )
}
