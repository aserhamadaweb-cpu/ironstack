'use client'

import { useEffect, useState } from 'react'
import { PageError, PageLoading } from '@/components/page-states'
import {
  SessionDetailView,
  type SessionDetailLift,
} from '@/components/session-detail-view'
import { getCachedLiftTypes } from '@/lib/offline/cache'
import { getLocalSession } from '@/lib/offline/session-store'
import { isCardioCategory, type WeightUnit } from '@/lib/units'

export function LocalSessionDetailFallback({
  id,
  displayName,
  initials,
  weightUnit,
}: {
  id: string
  displayName: string
  initials: string
  weightUnit: WeightUnit
}) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'missing' }
    | {
        kind: 'ready'
        title: string
        finishedAt: string
        durationSeconds: number
        totalVolume: number
        setsCompleted: number
        setsSkipped: number
        lifts: SessionDetailLift[]
      }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const session = await getLocalSession(id)
      if (cancelled) return
      if (!session || session.status !== 'completed') {
        setState({ kind: 'missing' })
        return
      }
      const lifts = await getCachedLiftTypes().catch(() => [])
      const nameById = new Map(lifts.map((row) => [row.id, row.name]))
      const byLift = new Map<string, SessionDetailLift>()
      let volume = 0
      let completed = 0
      let skipped = 0
      for (const log of session.logs) {
        if (log.isSkipped) skipped += 1
        else {
          completed += 1
          if (!(log.durationSeconds ?? 0)) {
            volume += (Number(log.weight) || 0) * (Number(log.reps) || 0)
          }
        }
        const name = nameById.get(log.liftTypeId) ?? 'Lift'
        const isCardio =
          isCardioCategory(
            lifts.find((row) => row.id === log.liftTypeId)?.category,
          ) || (log.durationSeconds ?? 0) > 0
        const current = byLift.get(log.liftTypeId) ?? { name, isCardio, sets: [] }
        current.sets.push({
          setNumber: log.setNumber,
          weight: log.weight,
          reps: log.reps,
          durationSeconds: log.durationSeconds,
          skipped: log.isSkipped,
        })
        byLift.set(log.liftTypeId, current)
      }
      setState({
        kind: 'ready',
        title: `${session.progress?.dayName || 'Day'} • ${session.progress?.splitName || 'Split'}`,
        finishedAt: session.finishedAt ?? session.startedAt,
        durationSeconds: session.durationSeconds ?? 0,
        totalVolume: volume,
        setsCompleted: completed,
        setsSkipped: skipped,
        lifts: [...byLift.values()].map((lift) => ({
          ...lift,
          sets: [...lift.sets].sort((a, b) => a.setNumber - b.setNumber),
        })),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (state.kind === 'loading') return <PageLoading label="Loading session…" />
  if (state.kind === 'missing') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message="That session is not on this device yet." />
      </main>
    )
  }

  return (
    <SessionDetailView
      displayName={displayName}
      initials={initials}
      title={state.title}
      finishedAt={state.finishedAt}
      durationSeconds={state.durationSeconds}
      totalVolume={state.totalVolume}
      setsCompleted={state.setsCompleted}
      setsSkipped={state.setsSkipped}
      lifts={state.lifts}
      weightUnit={weightUnit}
      backHref="/dashboard/history"
      backLabel="BACK TO HISTORY"
    />
  )
}
