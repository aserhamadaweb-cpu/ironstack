'use client'

import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import {
  formatHeatmapTooltip,
  type HeatmapCell,
} from '@/lib/heatmap'

/** Forge scale: ash → gold → molten heat (signature IRONSTACK craft). */
const INTENSITY_CLASS: Record<HeatmapCell['intensity'], string> = {
  0: 'forge-0',
  1: 'forge-1',
  2: 'forge-2',
  3: 'forge-3',
  4: 'forge-4',
}

const DAY_KEYS = ['', 'mon', '', 'wed', '', 'fri', ''] as const

type ActivityHeatmapProps = {
  cells?: HeatmapCell[]
  title?: string
  subtitle?: string
  weightUnit?: 'kg' | 'lb'
}

/**
 * Chronological weeks stay left→right even in RTL (intentional — matches
 * GitHub-style activity heatmaps and keeps date progression consistent).
 */
export function ActivityHeatmap({
  cells = [],
  title,
  subtitle,
  weightUnit = 'kg',
}: ActivityHeatmapProps) {
  const t = useTranslations('heatmap')
  const tDays = useTranslations('days')
  const tProfile = useTranslations('profile')
  const tEmpty = useTranslations('empty')
  const tCommon = useTranslations('common')
  const reduceMotion = useReducedMotion()
  const resolvedTitle = title ?? tProfile('forgeMap')
  const resolvedSubtitle = subtitle ?? tProfile('forgeSubtitle')
  const trained = useMemo(
    () => cells.filter((c) => c.intensity > 0).length,
    [cells],
  )
  const hotDays = useMemo(
    () => cells.filter((c) => c.intensity >= 3).length,
    [cells],
  )

  if (cells.length === 0) {
    return (
      <section className="is-panel p-5 sm:p-6">
        <p className="section-kicker">{t('consistency')}</p>
        <h2 className="font-heading mt-1 text-xl font-bold text-headline sm:text-2xl">
          {resolvedTitle}
        </h2>
        <div className="mt-5">
          <EmptyState
            icon={CalendarDays}
            title={tEmpty('noSessionsMap')}
            body={tEmpty('noSessionsMapBody')}
            actionLabel={tCommon('openWorkout')}
            actionHref="/dashboard/workout"
            tone="heat"
          />
        </div>
      </section>
    )
  }

  return (
    <section className="is-panel relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -top-20 end-0 h-40 w-40 rounded-full bg-heat/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 start-8 h-32 w-32 rounded-full bg-gold/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">{t('consistency')}</p>
          <h2 className="font-heading mt-1 text-xl font-bold text-headline sm:text-2xl">
            {resolvedTitle}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground tabular-nums">
            {resolvedSubtitle}
            {trained > 0
              ? ` · ${t('daysLit', { count: trained })}${
                  hotDays > 0 ? ` · ${t('heavy', { count: hotDays })}` : ''
                }`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-end text-[10px] tracking-[0.12em] text-muted-foreground sm:self-start">
          <span>{t('less')}</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              className={`size-2.5 rounded-sm ${INTENSITY_CLASS[level]}`}
              aria-hidden="true"
            />
          ))}
          <span>{t('more')}</span>
        </div>
      </div>

      {/* Keep chronological LTR grid regardless of page direction */}
      <div className="relative -mx-1 overflow-x-auto px-1 pb-1" dir="ltr">
        <div className="flex w-max items-start gap-2">
          <div
            className="grid shrink-0 grid-rows-7 gap-[3px] pt-0"
            aria-hidden="true"
          >
            {DAY_KEYS.map((key, i) => (
              <div
                key={i}
                className="flex h-[11px] items-center justify-end pe-0.5 text-[9px] leading-none text-muted-foreground sm:h-[12px]"
              >
                {key ? tDays(key) : ''}
              </div>
            ))}
          </div>

          <div
            className="grid grid-flow-col grid-rows-7 gap-[3px]"
            role="img"
            aria-label={t('ariaLabel')}
          >
            {cells.map((day, index) => (
              <motion.div
                key={day.date}
                title={formatHeatmapTooltip(day, weightUnit)}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.65 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.22,
                  delay: reduceMotion ? 0 : Math.min(index * 0.004, 0.55),
                  ease: 'easeOut',
                }}
                className={`size-[11px] rounded-sm sm:size-3 ${INTENSITY_CLASS[day.intensity]}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** @deprecated Prefer ActivityHeatmap with real session data. */
export { ActivityHeatmap as MonthHeatmap }
