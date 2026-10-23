'use client'

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { isCuratedTemplateId } from '@/lib/split-recommendations/curated-ids'
import type { SplitRecommendation } from '@/lib/split-recommendations/types'

type SplitRecommendationCardProps = {
  rec: SplitRecommendation
  selected: boolean
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
  busy: boolean
  compact?: boolean
}

export function SplitRecommendationCard({
  rec,
  selected,
  expanded,
  onToggle,
  onSelect,
  busy,
  compact = false,
}: SplitRecommendationCardProps) {
  const t = useTranslations('splitRecommendations')
  const isCustom = rec.templateId === 'custom_ai'
  const showMatch = !isCustom && !isCuratedTemplateId(rec.templateId)
  const matchLabel = isCustom
    ? t('customMatch')
    : showMatch
      ? t('matchScore', { score: rec.score })
      : null

  return (
    <article
      className={`split-recommendation-card ${
        selected
          ? 'border-gold/50 bg-gold/5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--gold)_15%,transparent)]'
          : 'border-silver/20 bg-background/50'
      } rounded-2xl border transition`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="box-border flex min-h-11 w-full max-w-full min-w-0 items-start gap-3 px-4 py-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Dumbbell className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 max-w-full flex-1 basis-0 overflow-hidden">
          <p className="rec-copy break-words font-heading text-base font-bold text-headline">
            {rec.name}
          </p>
          <div className="mt-1.5 flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
            <span className="rec-copy max-w-full break-words rounded-full border border-silver/25 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
              {rec.typeLabel}
            </span>
            {matchLabel ? (
              <LtrIsolate
                when={isLatinFragment(matchLabel)}
                className="rec-copy max-w-full break-words text-[10px] font-semibold text-gold"
              >
                {matchLabel}
              </LtrIsolate>
            ) : null}
          </div>
          <p
            className={`rec-copy mt-2 break-words text-sm text-muted-foreground ${compact && !expanded ? 'line-clamp-2' : ''}`}
            dir="auto"
          >
            {rec.rationale}
          </p>
          <p className="rec-copy mt-2 break-words text-xs text-muted-foreground">
            {t('daysPerWeek', { days: rec.daysPerWeek })}
          </p>
        </span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded ? (
        <div className="box-border min-w-0 max-w-full space-y-3 overflow-x-hidden border-t border-silver/15 px-4 py-4">
          {rec.warnings && rec.warnings.length > 0 ? (
            <div
              role="note"
              className="rounded-xl border border-gold/30 bg-gold-tint px-3 py-3 text-xs text-muted-foreground"
            >
              <p className="font-semibold text-gold">{t('warningsTitle')}</p>
              <ul className="mt-2 list-disc space-y-1 ps-4">
                {rec.warnings.map((warning) => (
                  <li key={warning} className="rec-copy break-words" dir="auto">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {rec.schedule.map((day) => (
            <div
              key={day.name}
              className="box-border min-w-0 max-w-full overflow-x-hidden rounded-xl border border-silver/15 bg-background/40 p-3"
            >
              <p className="rec-copy break-words text-sm font-semibold text-foreground">
                {day.name}
              </p>
              <p
                className="rec-copy break-words text-xs text-muted-foreground"
                dir="auto"
              >
                {day.subtitle}
              </p>
              <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                {day.exercises.slice(0, 6).map((ex) => (
                  <li
                    key={`${day.name}-${ex.name}`}
                    className="flex min-w-0 max-w-full items-center gap-2"
                  >
                    <ExerciseThumb
                      muscle={ex.muscles[0] ?? 'Core'}
                      image={ex.image}
                      name={ex.name}
                      className="size-9"
                    />
                    <span className="rec-copy min-w-0 flex-1 text-foreground" dir="auto">
                      {ex.name}
                    </span>
                    <LtrIsolate
                      when={isLatinFragment(`${ex.sets}× ${ex.reps}`)}
                      className="shrink-0 tabular-nums"
                    >
                      {ex.sets}× {ex.reps}
                    </LtrIsolate>
                  </li>
                ))}
              </ul>
              {day.finisherNote ? (
                <p
                  className="rec-copy mt-2 text-[11px] italic text-gold/90"
                  dir="auto"
                >
                  {day.finisherNote}
                </p>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={onSelect}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold tracking-[0.14em] text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            {t('selectProgram')}
          </button>
        </div>
      ) : null}
    </article>
  )
}
