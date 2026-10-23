'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Info, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExerciseThumb } from '@/components/exercise-thumb'
import type { SplitRecommendation } from '@/lib/split-recommendations/types'
import { applySplitRecommendationAction } from '@/lib/data/split-recommendation-actions'
import { RECOMMENDED_SPLITS_PATH } from '@/lib/split-create-paths'
import { CTA_PRIMARY } from '@/lib/accent'

type ReadySplitRowProps = {
  rec: SplitRecommendation
  busy: boolean
  onSave: (rec: SplitRecommendation) => void
}

export function ReadySplitRow({ rec, busy, onSave }: ReadySplitRowProps) {
  const t = useTranslations('splitRecommendations')

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-silver/20 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-heading text-base font-bold text-headline">{rec.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rec.typeLabel} · {t('daysPerWeek', { days: rec.daysPerWeek })}
        </p>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground" dir="auto">
          {rec.rationale}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href={`${RECOMMENDED_SPLITS_PATH}/${encodeURIComponent(rec.id)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-silver/30 px-4 text-xs font-bold tracking-[0.12em] text-muted-foreground transition hover:border-gold/40 hover:text-foreground"
        >
          <Info className="size-3.5" aria-hidden="true" />
          {t('detailsButton')}
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(rec)}
          className={`inline-flex min-h-11 items-center justify-center gap-2 px-4 text-xs font-bold tracking-[0.12em] disabled:opacity-60 ${CTA_PRIMARY}`}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          )}
          {t('saveButton')}
        </button>
      </div>
    </article>
  )
}

export function ReadySplitDetailView({
  recommendation,
}: {
  recommendation: SplitRecommendation
}) {
  const t = useTranslations('splitRecommendations')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await applySplitRecommendationAction(recommendation)
      if (result.error || !result.data?.splitId) {
        setError(result.error ?? t('saveFailed'))
        return
      }
      router.push(`/dashboard/workout`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="section-kicker">{recommendation.typeLabel}</p>
        <h1 className="font-heading text-3xl font-bold text-headline">
          {recommendation.name}
        </h1>
        <p className="text-sm text-muted-foreground" dir="auto">
          {recommendation.rationale}
        </p>
        <p className="text-xs font-semibold tracking-wide text-gold">
          {t('daysPerWeek', { days: recommendation.daysPerWeek })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className={`inline-flex min-h-11 items-center justify-center gap-2 px-5 text-xs font-bold tracking-[0.12em] disabled:opacity-60 ${CTA_PRIMARY}`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          )}
          {t('saveButton')}
        </button>
        <Link
          href={RECOMMENDED_SPLITS_PATH}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/30 px-5 text-xs font-bold tracking-[0.12em] text-muted-foreground transition hover:border-gold/40 hover:text-foreground"
        >
          {t('backToReadySplits')}
        </Link>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {recommendation.warnings && recommendation.warnings.length > 0 ? (
        <div
          role="note"
          className="rounded-xl border border-gold/30 bg-gold-tint px-4 py-3 text-xs text-muted-foreground"
        >
          <p className="font-semibold text-gold">{t('warningsTitle')}</p>
          <ul className="mt-2 list-disc space-y-1 ps-4">
            {recommendation.warnings.map((warning) => (
              <li key={warning} dir="auto">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-4">
        {recommendation.schedule.map((day, index) => (
          <section
            key={`${day.name}-${index}`}
            className="rounded-2xl border border-silver/20 bg-background/40 p-4 sm:p-5"
          >
            <h2 className="font-heading text-lg font-bold text-headline">
              {t('dayLabel', { day: index + 1, name: day.name })}
            </h2>
            {day.subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground" dir="auto">
                {day.subtitle}
              </p>
            ) : null}
            <ul className="mt-4 space-y-2.5">
              {day.exercises.map((ex) => (
                <li
                  key={`${day.name}-${ex.libraryId}-${ex.name}`}
                  className="flex items-center justify-between gap-3 border-b border-silver/10 pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ExerciseThumb
                      muscle={ex.muscles[0] ?? 'Core'}
                      image={ex.image}
                      name={ex.name}
                      className="size-11"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground" dir="auto">
                        {ex.name}
                      </p>
                      {ex.muscles.length > 0 ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {ex.muscles.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {ex.sets} × {ex.reps}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
