'use client'

import { AiCoachPanel } from '@/components/ai-coach-panel'
import { PersonalPrBoard } from '@/components/training-circle-feed'
import type { CoachInsightView } from '@/lib/ai/insights'
import { initialsFrom } from '@/lib/dashboard-utils'

type AiCoachDashboardProps = {
  displayName: string
  insight: CoachInsightView
}

export function AiCoachDashboard({
  displayName,
  insight,
}: AiCoachDashboardProps) {
  return (
    <div className="min-h-svh">


      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
        <div className="mb-8">
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
            AI COACH
          </p>
          <h1 className="font-heading text-metallic mt-1 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Your Personal Training Brain
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Cues pulled from your last session — not a placeholder. Chase the
            right PRs and keep the flame map lit.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <AiCoachPanel insight={insight} />
          <PersonalPrBoard />
        </div>
      </main>

    </div>
  )
}
