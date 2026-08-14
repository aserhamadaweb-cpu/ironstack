'use client'

import { Clock3, Dumbbell, Layers, Weight } from 'lucide-react'
import type { SessionSummaryData } from '@/lib/data/session-summary'

export type { SessionSummaryData }

type SessionSummaryCardProps = {
  data: SessionSummaryData
  className?: string
}

/** Same recap layout as Workout "Last Session Summary". */
export function SessionSummaryCard({
  data,
  className = '',
}: SessionSummaryCardProps) {
  return (
    <article
      className={`rounded-2xl border border-border bg-card p-5 sm:p-7 ${className}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border badge-amber px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]">
            {data.badge}
          </span>
          <span className="text-xs text-muted-foreground">{data.meta}</span>
        </div>
        <h3 className="font-heading mt-3 text-xl font-bold text-foreground sm:text-2xl">
          {data.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{data.blurb}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Duration', value: data.duration, icon: Clock3 },
            { label: 'Volume', value: data.volume, icon: Weight },
            { label: 'Sets', value: data.sets, icon: Layers },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-silver/10 bg-background/50 p-3"
            >
              <stat.icon className="mb-2 size-4 text-gold" aria-hidden="true" />
              <p className="font-heading text-lg font-bold tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                {stat.label.toUpperCase()}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2.5">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
            STANDOUT LIFTS
          </p>
          {data.standouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed sets logged this session.
            </p>
          ) : (
            data.standouts.map((lift) => (
              <div
                key={lift}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-silver/10 bg-background/40 px-4 py-3 text-sm text-muted-foreground"
              >
                <Dumbbell
                  className="size-4 shrink-0 text-gold"
                  aria-hidden="true"
                />
                {lift}
              </div>
            ))
          )}
        </div>
      </div>
    </article>
  )
}
