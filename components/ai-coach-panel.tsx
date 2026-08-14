'use client'

import Link from 'next/link'
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LtrIsolate } from '@/components/ltr-isolate'
import type { CoachInsightView } from '@/lib/ai/insights'

type AiCoachPanelProps = {
  insight: CoachInsightView
  /** Compact card for home / workout embeds. */
  compact?: boolean
  /** Where empty-state CTA should go (e.g. first split session). */
  startHref?: string
}

export function AiCoachPanel({
  insight,
  compact = false,
  startHref = '/dashboard/workout',
}: AiCoachPanelProps) {
  const t = useTranslations('coach')
  const isEmpty = insight.kind === 'empty'
  const padding = compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'

  if (isEmpty) {
    return (
      <section
        className={`relative overflow-hidden rounded-2xl border border-border border-s-[3px] border-s-blue bg-card ${padding}`}
      >
        <div
          className="pointer-events-none absolute -top-16 -end-10 h-40 w-40 rounded-full bg-blue/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-blue/35 bg-blue-tint text-blue">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-blue">
                {t('aiPowered')}
              </p>
              <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                {insight.headline || t('noInsights')}
              </h2>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {insight.detail || t('noInsightsBody')}
          </p>
          <Link
            href={startHref}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold px-5 text-xs font-bold tracking-[0.16em] text-background transition hover:bg-gold/90"
          >
            {t('startWorkout')}
            <ChevronRight className="size-4 rtl-flip" aria-hidden="true" />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <Link
      href="/dashboard/ai-coach"
      className={`group relative block overflow-hidden rounded-2xl border border-border border-s-[3px] border-s-blue bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-blue/40 hover:shadow-[0_12px_40px_-20px_rgba(78,161,245,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40 ${padding}`}
    >
      <div
        className="pointer-events-none absolute -top-16 -end-10 h-40 w-40 rounded-full bg-blue/10 blur-3xl transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue/35 bg-blue-tint text-blue">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-blue">
                {t('aiPowered')}
              </p>
              <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                {insight.headline}
              </h2>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 pt-1 text-[11px] font-semibold tracking-wide text-blue/90 transition-colors group-hover:text-blue">
            {t('openCoach')}
            <ChevronRight className="size-3.5 rtl-flip" aria-hidden="true" />
          </span>
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {insight.detail}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-success">
            <Database className="size-3" aria-hidden="true" />
            {t('grounded')}
          </span>
          {insight.sessionMeta && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2
                className="size-3 text-success/80"
                aria-hidden="true"
              />
              <LtrIsolate>{insight.sessionMeta}</LtrIsolate>
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
