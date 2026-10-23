'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Dumbbell,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ExerciseThumb } from '@/components/exercise-thumb'
import type { LiftProgressLog, LiftProgressMeta } from '@/lib/data/queries'
import {
  buildLiftProgressAnalytics,
  displayMuscleGroup,
  formatLoadChangePct,
} from '@/lib/lift-progress'
import {
  formatDurationSeconds,
  formatWeightKg,
  type WeightUnit,
} from '@/lib/units'

type ExerciseProgressDetailProps = {
  meta: LiftProgressMeta
  logs: LiftProgressLog[]
  unit: WeightUnit
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function ExerciseProgressDetail({
  meta,
  logs,
  unit,
}: ExerciseProgressDetailProps) {
  const t = useTranslations('progress')
  const analytics = buildLiftProgressAnalytics(logs, meta.category)

  const JourneyTrendIcon =
    analytics.loadInsight === 'down'
      ? TrendingDown
      : analytics.loadInsight === 'flat'
        ? Minus
        : TrendingUp

  const loadPctLabel =
    analytics.loadChangePct === null
      ? null
      : formatLoadChangePct(Math.abs(analytics.loadChangePct))

  const loadMessage = (() => {
    if (loadPctLabel === null) return null
    switch (analytics.loadInsight) {
      case 'up':
        return t('trendUp', { pct: loadPctLabel })
      case 'down':
        return t('trendDown', { pct: loadPctLabel })
      case 'flat':
        return t('trendFlat')
      default:
        return null
    }
  })()

  const bestLabel = analytics.isCardio
    ? formatDurationSeconds(analytics.bestDurationSeconds)
    : analytics.bestWeightKg != null
      ? `${formatWeightKg(analytics.bestWeightKg, unit)} × ${analytics.bestReps ?? 0}`
      : analytics.bestReps != null
        ? `${analytics.bestReps} reps`
        : '—'

  const sinceStartLabel =
    analytics.sinceStartPct == null
      ? null
      : formatLoadChangePct(analytics.sinceStartPct)

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/progress"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
        {t('backToProgress')}
      </Link>

      <header className="flex items-center gap-4">
        <ExerciseThumb
          muscle={meta.muscleGroup ?? 'Core'}
          image={meta.imageUrl}
          name={meta.name}
          className="size-16 sm:size-20"
        />
        <div className="min-w-0 space-y-2">
          <p className="section-kicker">{t('detailKicker')}</p>
          <h1 className="font-heading text-2xl font-bold text-headline sm:text-3xl">
            {meta.name}
          </h1>
          {meta.muscleGroup ? (
            <p className="text-sm text-muted-foreground">
              {displayMuscleGroup(meta.muscleGroup)}
            </p>
          ) : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article className="is-panel p-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
            {t('statBest')}
          </p>
          <p className="mt-1 font-heading text-lg font-bold text-headline">
            {bestLabel}
          </p>
        </article>
        <article className="is-panel p-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
            {t('statSessions')}
          </p>
          <p className="mt-1 font-heading text-lg font-bold text-headline tabular-nums">
            {analytics.sessionCount}
          </p>
        </article>
        <article className="is-panel p-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
            {t('statSets')}
          </p>
          <p className="mt-1 font-heading text-lg font-bold text-headline tabular-nums">
            {analytics.setCount}
          </p>
        </article>
        <article className="is-panel p-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
            {t('statSinceStart')}
          </p>
          <p
            className={`mt-1 font-heading text-lg font-bold tabular-nums ${
              analytics.sinceStartPct == null
                ? 'text-headline'
                : analytics.sinceStartPct > 2
                  ? 'text-success'
                  : analytics.sinceStartPct < -2
                    ? 'text-heat'
                    : 'text-headline'
            }`}
          >
            {sinceStartLabel ?? '—'}
          </p>
        </article>
      </section>

      <section className="is-panel p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="section-kicker">{t('trendKicker')}</p>
            <h2 className="font-heading mt-1 text-lg font-bold text-headline">
              {analytics.isCardio ? t('trendTitleCardio') : t('trendTitle')}
            </h2>
          </div>
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
              analytics.loadInsight === 'down'
                ? 'chip-amber'
                : analytics.loadInsight === 'flat'
                  ? 'border-border bg-background'
                  : 'chip-green'
            }`}
          >
            <JourneyTrendIcon className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div className="flex h-28 items-end gap-1.5" aria-hidden="true">
          {analytics.weeklyBars.map((height, index) => (
            <div
              key={index}
              className={`w-full rounded-t-sm bg-gradient-to-t transition-all ${
                analytics.weeklyValues[index] > 0
                  ? 'from-success/20 to-success/85'
                  : 'from-muted/20 to-muted/50'
              }`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        <p
          className={`mt-3 text-sm ${
            analytics.loadInsight === 'up'
              ? 'font-semibold text-success'
              : analytics.loadInsight === 'down'
                ? 'font-semibold text-heat'
                : 'text-muted-foreground'
          }`}
        >
          {analytics.loadInsight === 'empty'
            ? t('trendEmpty')
            : analytics.loadInsight === 'baseline'
              ? t('trendBaseline')
              : loadMessage ??
                t('trendWeeks', { weeks: analytics.weeksWithData })}
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <p className="section-kicker">{t('historyKicker')}</p>
          <h2 className="font-heading mt-1 text-lg font-bold text-headline">
            {t('historyTitle')}
          </h2>
        </div>

        {analytics.sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-silver/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {t('historyEmpty')}
          </p>
        ) : (
          <div className="space-y-3">
            {analytics.sessions.map((session) => {
              const sessionBest = analytics.isCardio
                ? formatDurationSeconds(session.bestDurationSeconds)
                : session.bestWeightKg > 0
                  ? `${formatWeightKg(session.bestWeightKg, unit)} × ${session.bestReps}`
                  : `${session.bestReps} reps`
              const dateLabel = formatSessionDate(session.loggedAt)
              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-headline">
                        <CalendarDays
                          className="size-3.5 shrink-0 text-gold"
                          aria-hidden="true"
                        />
                        <LtrIsolate when={isLatinFragment(dateLabel)}>
                          {dateLabel}
                        </LtrIsolate>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('sessionBest', { best: sessionBest })}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
                      <Dumbbell className="size-3" aria-hidden="true" />
                      {t('setCount', { count: session.sets.length })}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2 border-t border-silver/10 pt-3">
                    {session.sets.map((set, index) => {
                      const setLabel = analytics.isCardio
                        ? formatDurationSeconds(set.durationSeconds)
                        : set.repsOnly
                          ? `${set.reps} reps`
                          : `${formatWeightKg(set.weightKg, unit)} × ${set.reps}`
                      return (
                        <li
                          key={set.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {t('setLabel', {
                              number: set.setNumber ?? index + 1,
                            })}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {setLabel}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )

              if (session.sessionId) {
                return (
                  <Link
                    key={session.key}
                    href={`/dashboard/sessions/${session.sessionId}`}
                    className="is-panel block p-4 transition hover:border-gold/35"
                  >
                    {body}
                  </Link>
                )
              }

              return (
                <article key={session.key} className="is-panel p-4">
                  {body}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
