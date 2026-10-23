'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Search, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { ExerciseThumb } from '@/components/exercise-thumb'
import type { PracticedLiftSummary } from '@/lib/data/queries'
import { displayMuscleGroup } from '@/lib/lift-progress'
import {
  formatDurationSeconds,
  formatWeightKg,
  isCardioCategory,
  type WeightUnit,
} from '@/lib/units'

type ExerciseProgressListProps = {
  lifts: PracticedLiftSummary[]
  unit: WeightUnit
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function groupByMuscle(
  lifts: PracticedLiftSummary[],
  otherLabel: string,
) {
  const groups = new Map<string, PracticedLiftSummary[]>()
  for (const lift of lifts) {
    const key = displayMuscleGroup(lift.muscleGroup) || otherLabel
    const list = groups.get(key) ?? []
    list.push(lift)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(
      ([muscle, items]) =>
        [
          muscle,
          [...items].sort((a, b) => a.name.localeCompare(b.name)),
        ] as const,
    )
    .sort(([a], [b]) => a.localeCompare(b))
}

export function ExerciseProgressList({
  lifts,
  unit,
}: ExerciseProgressListProps) {
  const t = useTranslations('progress')
  const tCommon = useTranslations('common')
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const [seededGroups, setSeededGroups] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lifts
    return lifts.filter((lift) => {
      const muscle = displayMuscleGroup(lift.muscleGroup).toLowerCase()
      return (
        lift.name.toLowerCase().includes(q) || muscle.includes(q)
      )
    })
  }, [lifts, query])

  const groups = useMemo(
    () => groupByMuscle(filtered, t('otherGroup')),
    [filtered, t],
  )

  useEffect(() => {
    if (seededGroups || groups.length === 0) return
    setOpenGroups(new Set([groups[0][0]]))
    setSeededGroups(true)
  }, [groups, seededGroups])

  const searching = query.trim().length > 0
  const allOpen =
    searching ||
    (groups.length > 0 && groups.every(([name]) => openGroups.has(name)))

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (lifts.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title={t('empty')}
        body={t('emptyBody')}
        actionLabel={tCommon('openWorkout')}
        actionHref="/dashboard/workout"
        tone="heat"
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('searchLabel')}</span>
          <Search
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-11 w-full rounded-xl border border-border bg-background/70 pe-3 ps-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        {groups.length > 0 && !searching ? (
          <button
            type="button"
            onClick={() =>
              allOpen
                ? setOpenGroups(new Set())
                : setOpenGroups(new Set(groups.map(([name]) => name)))
            }
            className="h-11 shrink-0 rounded-xl border border-silver/15 px-4 text-[10px] font-bold tracking-[0.16em] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
          >
            {allOpen ? t('collapseAll') : t('expandAll')}
          </button>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-silver/20 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {t('noMatch', { query: query.trim() })}
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(([muscle, items]) => {
            const groupOpen = searching || openGroups.has(muscle)
            return (
              <div key={muscle} className="is-panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (!searching) toggleGroup(muscle)
                  }}
                  aria-expanded={groupOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition hover:bg-foreground/[0.03]"
                >
                  <span className="min-w-0">
                    <span className="font-heading text-base font-semibold text-headline">
                      {muscle}
                    </span>
                    <span className="ms-2 text-[10px] tracking-[0.14em] tabular-nums text-muted-foreground">
                      {t('liftCount', { count: items.length })}
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition ${
                      groupOpen ? 'rotate-180 text-gold' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {groupOpen ? (
                  <ul className="divide-y divide-silver/10 border-t border-silver/10">
                    {items.map((lift) => {
                      const cardio = isCardioCategory(lift.category)
                      const bestLabel = cardio
                        ? formatDurationSeconds(lift.bestDurationSeconds)
                        : lift.bestWeightKg != null
                          ? `${formatWeightKg(lift.bestWeightKg, unit)} × ${lift.bestReps ?? 0}`
                          : lift.bestReps != null
                            ? `${lift.bestReps} reps`
                            : '—'
                      return (
                        <li key={lift.liftTypeId}>
                          <Link
                            href={`/dashboard/progress/${encodeURIComponent(lift.liftTypeId)}`}
                            className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-gold/5"
                          >
                            <ExerciseThumb
                              muscle={lift.muscleGroup ?? 'Core'}
                              image={lift.imageUrl}
                              name={lift.name}
                              className="size-14"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-heading text-base font-semibold text-headline">
                                {lift.name}
                              </p>
                              <p className="mt-0.5 text-sm text-foreground">
                                {t('bestLine', { best: bestLabel })}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {t('sessionLast', {
                                  sessions: lift.sessionCount,
                                  last: formatShortDate(lift.lastLoggedAt),
                                })}
                              </p>
                            </div>
                            <ChevronRight
                              className="size-4 shrink-0 text-muted-foreground rtl-flip"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
