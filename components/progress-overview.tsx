'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ProgressOverview } from '@/lib/data/queries'
import { formatDuration } from '@/lib/session-store'
import { formatLoadChangePct } from '@/lib/volume-trend'
import { formatVolumeKg, type WeightUnit } from '@/lib/units'

type ProgressOverviewProps = {
  overview: ProgressOverview
  unit: WeightUnit
}

export function ProgressOverviewPanel({
  overview,
  unit,
}: ProgressOverviewProps) {
  const t = useTranslations('progress')
  const maxMuscleVolume = Math.max(
    ...overview.muscles.map((muscle) => muscle.totalVolumeKg),
    1,
  )

  const trendValue =
    overview.loadChangePct == null ||
    overview.loadInsight === 'empty' ||
    overview.loadInsight === 'baseline'
      ? null
      : formatLoadChangePct(overview.loadChangePct)

  const trendLabel = (() => {
    if (overview.loadInsight === 'up' && overview.loadChangePct != null) {
      return t('trendUpOverall', {
        pct: formatLoadChangePct(Math.abs(overview.loadChangePct)),
      })
    }
    if (overview.loadInsight === 'down' && overview.loadChangePct != null) {
      return t('trendDownOverall', {
        pct: formatLoadChangePct(Math.abs(overview.loadChangePct)),
      })
    }
    if (overview.loadInsight === 'flat') return t('trendFlatOverall')
    if (overview.loadInsight === 'baseline') return t('trendBaselineOverall')
    return null
  })()

  const trendDown = overview.loadInsight === 'down'

  return (
    <div className="space-y-10">
      <article className="is-panel overflow-hidden p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-kicker">{t('analyticsKicker')}</p>
            <p
              className={`font-heading mt-3 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl ${
                trendDown ? 'text-heat' : 'text-success'
              }`}
            >
              {trendValue ?? '—'}
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {trendLabel ?? t('summaryTitle')}
            </p>
          </div>
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${
              trendDown
                ? 'border-heat/30 bg-heat/10 text-heat'
                : 'border-success/30 bg-success/10 text-success'
            }`}
          >
            {trendDown ? (
              <TrendingDown className="size-5" aria-hidden="true" />
            ) : (
              <TrendingUp className="size-5" aria-hidden="true" />
            )}
          </span>
        </div>

        <div
          className="mt-6 flex h-20 items-end gap-1.5 rounded-xl bg-foreground/[0.03] px-3 pt-3"
          aria-hidden="true"
        >
          {overview.weeklyBars.map((height, index) => (
            <div
              key={index}
              className={`w-full rounded-t-md ${
                height > 8 ? 'bg-success' : 'bg-success/25'
              }`}
              style={{ height: `${Math.max(8, height)}%` }}
            />
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-silver/15 bg-silver/15 sm:grid-cols-4">
          <Stat label={t('statSessions')} value={String(overview.totals.sessionCount)} />
          <Stat
            label={t('statVolume')}
            value={formatVolumeKg(overview.totals.totalVolumeKg, unit)}
          />
          <Stat label={t('statSets')} value={String(overview.totals.totalSets)} />
          <Stat
            label={t('statTime')}
            value={formatDuration(overview.totals.totalDurationSeconds)}
          />
        </dl>
      </article>

      <section className="space-y-4">
        <div>
          <p className="section-kicker">{t('musclesKicker')}</p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-headline">
            {t('musclesTitle')}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t('musclesBody')}</p>
        </div>
        {overview.muscles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-silver/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {t('musclesEmpty')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {overview.muscles.map((muscle) => {
              const down = (muscle.changePct ?? 0) < -2
              const flat = muscle.changePct != null && Math.abs(muscle.changePct) <= 2
              const share = Math.max(
                8,
                Math.round((muscle.totalVolumeKg / maxMuscleVolume) * 100),
              )
              const change =
                muscle.changePct == null
                  ? t('muscleNew')
                  : flat
                    ? t('muscleFlat')
                    : t('muscleChange', {
                        pct: formatLoadChangePct(muscle.changePct),
                      })
              return (
                <li key={muscle.muscle} className="is-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-heading text-lg font-bold text-headline">
                      {muscle.muscle}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${
                        down
                          ? 'border-heat/30 text-heat'
                          : flat || muscle.changePct == null
                            ? 'border-silver/25 text-muted-foreground'
                            : 'border-success/30 text-success'
                      }`}
                    >
                      {muscle.changePct == null
                        ? '—'
                        : formatLoadChangePct(muscle.changePct)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{change}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className={`h-full rounded-full ${down ? 'bg-heat' : 'bg-success'}`}
                      style={{ width: `${muscle.totalVolumeKg > 0 ? share : 8}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('muscleMeta', {
                      sessions: muscle.sessionCount,
                      sets: muscle.setCount,
                      volume: formatVolumeKg(muscle.totalVolumeKg, unit),
                    })}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-3">
      <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-heading text-lg font-bold text-headline">{value}</dd>
    </div>
  )
}
