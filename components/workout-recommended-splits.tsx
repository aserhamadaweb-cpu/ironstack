'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { SplitRecommendation } from '@/lib/split-recommendations'
import { applySplitRecommendationAction } from '@/lib/data/split-recommendation-actions'
import { SplitRecommendationCard } from '@/components/split-recommendation-card'
import { useGuestGate } from '@/components/guest-gate-provider'
import { AI_SPLIT_BUILDER_PATH } from '@/lib/split-create-paths'

type WorkoutRecommendedSplitsProps = {
  recommendations: SplitRecommendation[]
  error?: string | null
  /** Hide for guests — they see upgrade on save. */
  isGuest?: boolean
}

export function WorkoutRecommendedSplits({
  recommendations,
  error = null,
  isGuest = false,
}: WorkoutRecommendedSplitsProps) {
  const t = useTranslations('workout')
  const tRec = useTranslations('splitRecommendations')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const [expandedId, setExpandedId] = useState<string | null>(
    recommendations[0]?.id ?? null,
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (error && recommendations.length === 0) {
    return (
      <section className="mb-10" data-tour="workout-recommendations">
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            {t('recommendedForYou')}
          </p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
            {t('chooseSplit')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Link
          href={AI_SPLIT_BUILDER_PATH}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/35 px-5 text-xs font-bold tracking-[0.12em] text-gold"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {tRec('aiBuilderTitle')}
        </Link>
      </section>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  const visible = recommendations.slice(0, 3)

  const handleSave = (rec: SplitRecommendation) => {
    requireAccount('createSplit', () => {
      setSaveError(null)
      startTransition(async () => {
        const result = await applySplitRecommendationAction(rec)
        if (result.error || !result.data?.splitId) {
          setSaveError(result.error ?? tRec('saveFailed'))
          return
        }
        router.push(`/dashboard/splits/${result.data.splitId}`)
        router.refresh()
      })
    })
  }

  return (
    <section className="mb-10 min-w-0" data-tour="workout-recommendations">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            {t('recommendedForYou')}
          </p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
            {t('chooseSplit')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('chooseSplitBody')}</p>
        </div>
        <Link
          href="/dashboard/splits/recommendations"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold tracking-[0.12em] text-gold"
        >
          {tRec('seeAllPrograms')}
          <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
        </Link>
      </div>

      {isGuest ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {tRec('onboardingBody')}
        </p>
      ) : null}

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
        {visible.map((rec) => (
          <div
            key={rec.id}
            className="w-[min(100%,20rem)] shrink-0 snap-start sm:w-[18rem]"
          >
            <SplitRecommendationCard
              rec={rec}
              selected={false}
              expanded={expandedId === rec.id}
              onToggle={() =>
                setExpandedId((current) => (current === rec.id ? null : rec.id))
              }
              onSelect={() => handleSave(rec)}
              busy={pending}
              compact
            />
          </div>
        ))}
      </div>

      {saveError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
    </section>
  )
}
