'use client'

import { useMemo, useState } from 'react'
import { Trophy, BarChart3, History, TrendingUp, Zap, Dumbbell } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { MOCK_PRS, type PersonalRecord } from '@/lib/mock-pr-data'

export function AnalyticsDashboard() {
  const [records] = useState<PersonalRecord[]>(MOCK_PRS)

  const analytics = useMemo(() => {
    const currentPrs = records.filter((r) => r.isCurrentPr)
    const heaviest = currentPrs.reduce<PersonalRecord | null>((top, r) => {
      if (!top || r.weight > top.weight) return r
      return top
    }, null)

    // Epley 1RM Calculation
    const estimated1RM = heaviest 
      ? Math.round(heaviest.weight * (1 + heaviest.reps / 30)) 
      : 0

    const totalVolume = records.reduce((sum, r) => sum + (r.weight * r.reps), 0)

    // Group logs into simulated recent sessions for the chart
    const chartData = [
      { label: 'Session 1', volume: 1100, height: '45%' },
      { label: 'Session 2', volume: 1350, height: '55%' },
      { label: 'Session 3', volume: 1200, height: '50%' },
      { label: 'Session 4', volume: 1600, height: '65%' },
      { label: 'Session 5', volume: 1850, height: '80%' },
      { label: 'Latest', volume: 2100, height: '100%' },
    ]

    return { estimated1RM, totalVolume, heaviest, chartData, currentPrs }
  }, [records])

  return (
    <div className="min-h-svh">
      <DashboardNav />

      <main className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        <BackToTrainLink className="mb-6" />
        <div className="fade-up mb-8 flex flex-col gap-2 md:mb-10">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            DEEP-DIVE METRICS
          </p>
          <h1 className="font-heading text-metallic text-3xl font-bold tracking-tight md:text-4xl">
            Performance Analytics
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Analyze your progressive overload, track estimated strength ceilings, and review your historical milestones.
          </p>
        </div>

        {/* Top Summary Grid */}
        <div className="fade-up mb-8 grid gap-4 md:grid-cols-3">
          <div className="glass-card flex flex-col justify-between rounded-2xl border border-silver/10 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                  ESTIMATED 1-REP MAX
                </p>
                <p className="mt-2 font-heading text-4xl font-bold tabular-nums text-foreground">
                  {analytics.estimated1RM > 0 ? `${analytics.estimated1RM} kg` : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Based on {analytics.heaviest?.liftName} ({analytics.heaviest?.weight}kg × {analytics.heaviest?.reps})
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl border border-silver/15 bg-background/40 text-gold">
                <Trophy className="size-6" />
              </div>
            </div>
          </div>

          <div className="glass-card flex flex-col justify-between rounded-2xl border border-silver/10 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-silver">
                  TOTAL VOLUME LOAD
                </p>
                <p className="mt-2 font-heading text-4xl font-bold tabular-nums text-foreground">
                  {analytics.totalVolume.toLocaleString()} <span className="text-base font-normal text-muted-foreground">kg</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cumulative work across all logged sessions
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl border border-silver/15 bg-background/40 text-silver">
                <BarChart3 className="size-6" />
              </div>
            </div>
          </div>

          <div className="glass-card flex flex-col justify-between rounded-2xl border border-silver/10 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                  ACTIVE MILSTONE PRs
                </p>
                <p className="mt-2 font-heading text-4xl font-bold tabular-nums text-foreground">
                  {analytics.currentPrs.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Currently holding records across compound lifts
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl border chip-amber">
                <Zap className="size-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Visual Volume Chart */}
        <section className="fade-up mb-8 glass-card rounded-2xl border border-silver/10 p-6 md:p-8" style={{ animationDelay: '0.1s' }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <TrendingUp className="size-5 text-gold" />
                Volume Progression Overload
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Visualizing total workload output across recent training blocks
              </p>
            </div>
            <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
              +19% This Month
            </span>
          </div>

          {/* Pure CSS Bar Chart */}
          <div className="mt-8 flex h-64 items-end gap-3 md:gap-6 pt-6 border-b border-silver/10 pb-4">
            {analytics.chartData.map((bar) => (
              <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] font-mono text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {bar.volume}kg
                </span>
                <div 
                  className="w-full rounded-t-lg bg-gradient-to-t from-gold/20 to-gold/80 transition-all duration-500 hover:brightness-125 hover:from-gold/40 hover:to-gold border-t border-gold/50"
                  style={{ height: bar.height }}
                />
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground mt-2 truncate">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Detailed Milestones Table */}
        <section className="fade-up glass-card rounded-2xl border border-silver/10 p-6" style={{ animationDelay: '0.2s' }}>
          <div className="mb-4 flex items-center gap-2">
            <History className="size-5 text-silver" />
            <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
              All Personal Record Milestones
            </h2>
          </div>
          
          <div className="divide-y divide-silver/10 mt-4">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-silver/5 border border-silver/10">
                    <Dumbbell className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{r.liftName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Logged {new Date(r.loggedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-bold text-gold">
                    {r.weight} kg
                  </span>
                  <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                    × {r.reps} {r.reps === 1 ? 'rep' : 'reps'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}