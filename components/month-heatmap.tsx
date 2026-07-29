'use client'

import { Flame } from 'lucide-react'
import { getMonthHeatmap, type HeatDay } from '@/lib/dashboard-utils'

const INTENSITY_CLASS: Record<HeatDay['intensity'], string> = {
  0: 'border-zinc-700/80 bg-zinc-950/70',
  1: 'border-orange-900/50 bg-orange-950/40',
  2: 'border-orange-700/50 bg-orange-900/45',
  3: 'border-orange-500/50 bg-orange-700/50',
  4: 'border-orange-400/70 bg-orange-500/55 shadow-[0_0_12px_-4px_rgba(249,115,22,0.55)]',
}

type MonthHeatmapProps = {
  days?: number
  title?: string
  subtitle?: string
}

export function MonthHeatmap({
  days = 84,
  title = 'Training Heatmap',
  subtitle = 'Last 12 weeks — flame intensity mirrors your weekly streak strip.',
}: MonthHeatmapProps) {
  const cells = getMonthHeatmap(days)
  const trained = cells.filter((day) => day.intensity > 0).length

  return (
    <section className="glass-card rounded-2xl border border-silver/10 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            CONSISTENCY
          </p>
          <h2 className="font-heading mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border badge-amber px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em]">
          <Flame className="size-3 fill-current text-gold" aria-hidden="true" />
          {trained} DAYS LIT
        </span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          className="grid w-max grid-flow-col grid-rows-7 gap-1.5"
          role="img"
          aria-label="Monthly training activity heatmap"
        >
          {cells.map((day) => (
            <div
              key={day.date}
              title={`${day.date}${day.intensity ? ` · intensity ${day.intensity}` : ' · rest'}`}
              className={`size-3.5 rounded-[4px] border sm:size-4 ${INTENSITY_CLASS[day.intensity]}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] tracking-[0.12em] text-muted-foreground">
        <span>LESS</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={`size-3 rounded-[3px] border sm:size-3.5 ${INTENSITY_CLASS[level]}`}
            aria-hidden="true"
          />
        ))}
        <span>MORE</span>
      </div>
    </section>
  )
}
