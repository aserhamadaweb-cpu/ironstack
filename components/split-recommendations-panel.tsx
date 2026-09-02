'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import type { SplitRecommendation } from '@/lib/split-recommendations'
import {
  applySplitRecommendationAction,
  generateSplitRecommendationsAction,
  skipSplitRecommendationAction,
} from '@/lib/data/split-recommendation-actions'
import { SplitRecommendationCard } from '@/components/split-recommendation-card'

const STANDALONE_REC_LIMIT = 2

function limitRecommendations(
  recs: SplitRecommendation[],
  mode: 'onboarding' | 'standalone',
): SplitRecommendation[] {
  return mode === 'standalone' ? recs.slice(0, STANDALONE_REC_LIMIT) : recs
}

type SplitRecommendationsPanelProps = {
  mode: 'onboarding' | 'standalone'
  initialRecommendations?: SplitRecommendation[]
  /** Server-computed profile fingerprint — refetch when this changes. */
  fingerprint?: string | null
  initialError?: string | null
  onSelected?: (splitId: string) => void
  onSkipped?: () => void
}

export function SplitRecommendationsPanel({
  mode,
  initialRecommendations,
  fingerprint = null,
  initialError = null,
  onSelected,
  onSkipped,
}: SplitRecommendationsPanelProps) {
  const t = useTranslations('splitRecommendations')
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(!initialRecommendations?.length)
  const [error, setError] = useState<string | null>(initialError)
  const [recommendations, setRecommendations] = useState<SplitRecommendation[]>(
    limitRecommendations(initialRecommendations ?? [], mode),
  )
  const [savedNotice, setSavedNotice] = useState(false)
  const [savedProgramName, setSavedProgramName] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(
    mode === 'onboarding' ? (initialRecommendations?.[0]?.id ?? null) : null,
  )

  useEffect(() => {
    if (mode === 'standalone') {
      window.scrollTo(0, 0)
    }
  }, [mode])

  useEffect(() => {
    if (mode === 'standalone' && initialRecommendations?.length) {
      setRecommendations(limitRecommendations(initialRecommendations, mode))
      setLoading(false)
      setError(initialError)
      return
    }

    if (mode === 'standalone' && initialError) {
      setRecommendations([])
      setLoading(false)
      setError(initialError)
      return
    }

    let cancelled = false
    setLoading(true)
    void generateSplitRecommendationsAction().then((result) => {
      if (cancelled) return
      if (result.error || !result.data) {
        setError(result.error ?? t('empty'))
        setRecommendations([])
        setLoading(false)
        return
      }
      setRecommendations(limitRecommendations(result.data, mode))
      if (mode === 'onboarding') {
        setExpandedId(result.data[0]?.id ?? null)
      }
      setLoading(false)
      setError(null)
    })
    return () => {
      cancelled = true
    }
  }, [mode, initialRecommendations, initialError, fingerprint, t])

  function handleSaved(_splitId?: string, programName?: string) {
    setSavedNotice(true)
    setSavedProgramName(programName ?? null)
    setError(null)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  function handleSelect(rec: SplitRecommendation) {
    setError(null)
    startTransition(async () => {
      const result = await applySplitRecommendationAction(rec)
      if (result.error || !result.data?.splitId) {
        setError(result.error ?? t('saveFailed'))
        return
      }
      handleSaved(result.data.splitId, rec.name)
      onSelected?.(result.data.splitId)
    })
  }

  function handleSkip() {
    setError(null)
    startTransition(async () => {
      const skipped = await skipSplitRecommendationAction()
      if (!skipped.ok) {
        setError(skipped.error)
        return
      }
      onSkipped?.()
    })
  }

  const busy = pending || loading

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

      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {mode === 'onboarding' ? t('onboardingTitle') : t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'onboarding' ? t('onboardingBody') : t('body')}
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
        {t('medicalDisclaimer')}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-gold" aria-hidden="true" />
          {t('loading')}
        </div>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div
          className="space-y-3"
          data-tour="split-recommendations-panel"
          data-recommendation-fingerprint={fingerprint ?? undefined}
        >
          {recommendations.map((rec) => (
            <SplitRecommendationCard
              key={rec.id}
              rec={rec}
              selected={expandedId === rec.id}
              expanded={expandedId === rec.id}
              busy={busy}
              onToggle={() =>
                setExpandedId((cur) => (cur === rec.id ? null : rec.id))
              }
              onSelect={() => handleSelect(rec)}
            />
          ))}
        </div>
      )}

      {mode === 'onboarding' ? (
        <button
          type="button"
          disabled={busy}
          onClick={handleSkip}
          className="min-h-11 text-sm text-muted-foreground transition hover:text-gold disabled:opacity-50"
        >
          {t('skipForNow')}
        </button>
      ) : null}
    </div>
  )
}
