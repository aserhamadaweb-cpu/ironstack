'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { History } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { listLocalCompletedSessions } from '@/lib/offline/session-store'
import { formatDuration, formatSessionDate } from '@/lib/session-store'
import { formatVolumeKg, type WeightUnit } from '@/lib/units'

type HistoryRow = {
  id: string
  splitName: string
  dayName: string | null
  when: string
  durationSeconds: number | null
  totalVolume: number
  completed: number
  skipped: number
}

export function HistorySessionList({
  initial,
  unit,
  error,
}: {
  initial: HistoryRow[]
  unit: WeightUnit
  error?: string | null
}) {
  const t = useTranslations('history')
  const tCommon = useTranslations('common')
  const [extra, setExtra] = useState<HistoryRow[]>([])

  useEffect(() => {
    let cancelled = false
    void listLocalCompletedSessions()
      .then((sessions) => {
        if (cancelled) return
        const known = new Set(initial.map((row) => row.id))
        setExtra(
          sessions
            .filter((session) => !known.has(session.id))
            .map((session) => {
              const volume = session.logs.reduce((sum, log) => {
                if (log.isSkipped || (log.durationSeconds ?? 0) > 0) return sum
                return sum + (Number(log.weight) || 0) * (Number(log.reps) || 0)
              }, 0)
              return {
                id: session.id,
                splitName: session.progress?.splitName || t('openSession'),
                dayName: session.progress?.dayName ?? null,
                when: session.finishedAt ?? session.startedAt,
                durationSeconds: session.durationSeconds,
                totalVolume: volume,
                completed: session.logs.filter((log) => !log.isSkipped).length,
                skipped: session.logs.filter((log) => log.isSkipped).length,
              }
            }),
        )
      })
      .catch(() => {
        if (!cancelled) setExtra([])
      })
    return () => {
      cancelled = true
    }
  }, [initial, t])

  const rows = useMemo(() => {
    const merged = [...extra, ...initial]
    const seen = new Set<string>()
    return merged.filter((row) => {
      if (seen.has(row.id)) return false
      seen.add(row.id)
      return true
    })
  }, [extra, initial])

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <EmptyState
          icon={History}
          title={t('empty')}
          body={t('emptyBody')}
          actionLabel={tCommon('openWorkout')}
          actionHref="/dashboard/workout"
          tone="heat"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour="history-list">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
      {rows.map((session) => (
        <li key={session.id}>
          <Link
            href={`/dashboard/sessions/${session.id}`}
            className="is-row flex min-h-11 w-full flex-col gap-2 px-4 py-4 text-start sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold text-foreground">
                {session.splitName}
                {session.dayName ? (
                  <span className="text-muted-foreground"> · {session.dayName}</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatSessionDate(session.when)}
                {session.durationSeconds != null
                  ? ` · ${formatDuration(session.durationSeconds)}`
                  : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3 text-xs sm:flex-col sm:items-end sm:gap-1">
              <span className="font-semibold tabular-nums text-gold">
                {formatVolumeKg(session.totalVolume, unit)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {t('done', { count: session.completed })}
                {session.skipped > 0
                  ? ` · ${t('skipped', { count: session.skipped })}`
                  : ''}
              </span>
            </div>
          </Link>
        </li>
      ))}
      </ul>
    </div>
  )
}
