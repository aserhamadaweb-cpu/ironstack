'use client'

import Link from 'next/link'
import { BrainCircuit, Sparkles } from 'lucide-react'
import { getLastSessionSummary } from '@/lib/dashboard-utils'

type AiCoachPanelProps = {
  athleteName: string
  /** Compact card for home / workout embeds. */
  compact?: boolean
}

function buildTip(athleteName: string) {
  const session = getLastSessionSummary()
  const top = session.standouts[0]
  const firstName = athleteName.trim().split(/\s+/)[0] || athleteName

  if (!top) {
    return {
      headline: `Ready when you are, ${firstName}`,
      body: 'Log a session and your coach will start reading the room — volume, rest, and the lifts that need a cue.',
      focus: 'Start your next workout',
    }
  }

  return {
    headline: `${top.lift} is your leverage point`,
    body: `Last ${session.name.toLowerCase()} you hit ${top.weight} kg × ${top.reps}. ${
      top.cue
        ? `Keep the cue: “${top.cue}”.`
        : 'Add a technical note next time so cues stick between sessions.'
    } Push volume 5–8% this week, then retest a heavy single.`,
    focus: `${session.dateLabel} · ${session.sets} sets · ${Math.round(session.volumeKg / 1000)}k kg`,
  }
}

export function AiCoachPanel({ athleteName, compact = false }: AiCoachPanelProps) {
  const tip = buildTip(athleteName)

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-border bg-card ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border chip-amber">
              <BrainCircuit className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                AI-POWERED COACHING
              </p>
              <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">
                {tip.headline}
              </h2>
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {tip.body}
          </p>

          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-silver/15 bg-zinc-950/50 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-300">
            <Sparkles className="size-3 text-gold" aria-hidden="true" />
            {tip.focus}
          </p>
        </div>

        {!compact && (
          <Link
            href="/dashboard/workout"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold tracking-[0.16em] text-primary-foreground transition-all hover:bg-primary/90"
          >
            APPLY IN WORKOUT
          </Link>
        )}
      </div>
    </section>
  )
}
