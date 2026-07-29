'use client'

import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { LogLiftForm, type LogLiftPayload } from '@/components/log-lift-form'
import {
  MOCK_PRS,
  formatLiftDate,
  formatWeight,
  type PersonalRecord,
} from '@/lib/mock-pr-data'

function createId() {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function isNewPersonalRecord(
  records: PersonalRecord[],
  liftName: string,
  weight: number,
  reps: number,
) {
  const sameLift = records.filter((record) => record.liftName === liftName)
  if (sameLift.length === 0) return true

  const best = sameLift.reduce((top, record) =>
    record.weight > top.weight ? record : top,
  )

  return weight > best.weight || (weight === best.weight && reps < best.reps)
}

export function LiftTrackerDashboard() {
  const [records, setRecords] = useState<PersonalRecord[]>(MOCK_PRS)

  const recent = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
      ),
    [records],
  )

  function handleLogLift({ liftName, weight, reps }: LogLiftPayload) {
    const isPr = isNewPersonalRecord(records, liftName, weight, reps)

    setRecords((prev) => {
      const updated = prev.map((record) =>
        record.liftName === liftName && isPr
          ? { ...record, isCurrentPr: false }
          : record,
      )

      const newEntry: PersonalRecord = {
        id: createId(),
        liftName,
        weight,
        reps,
        unit: 'kg',
        loggedAt: new Date().toISOString(),
        isCurrentPr: isPr,
      }

      return [newEntry, ...updated]
    })
  }

  return (
    <div className="min-h-svh">
      <DashboardNav />

      <main className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        <div className="fade-up mb-8 flex flex-col gap-2 md:mb-10">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            LIFT TRACKER
          </p>
          <h1 className="font-heading text-metallic text-3xl font-bold tracking-tight md:text-4xl">
            Log Today&apos;s Session
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Record every set and keep your working weights moving in the right
            direction. New bests are flagged automatically.
          </p>
        </div>

        <div
          className="fade-up grid gap-6 lg:grid-cols-[380px_1fr]"
          style={{ animationDelay: '0.1s' }}
        >
          <LogLiftForm onSubmit={handleLogLift} />

          <section className="glass-card sheen-border flex flex-col rounded-2xl">
            <div className="flex items-center gap-2 border-b border-silver/10 px-6 py-5">
              <History className="size-5 text-silver" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-semibold tracking-[0.25em] text-gold">
                  ACTIVITY
                </p>
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  Recent Sessions
                </h2>
              </div>
            </div>

            <div className="divide-y divide-silver/5">
              {recent.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {record.liftName}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {formatLiftDate(record.loggedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-heading text-base font-semibold tabular-nums text-foreground">
                      {formatWeight(record.weight, record.unit)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        × {record.reps}
                      </span>
                    </span>
                    {record.isCurrentPr ? (
                      <span className="inline-flex w-12 justify-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-gold">
                        PR
                      </span>
                    ) : (
                      <span className="inline-flex w-12 justify-center rounded-full border border-silver/20 px-2.5 py-1 text-[10px] font-medium tracking-[0.15em] text-muted-foreground">
                        LOG
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
