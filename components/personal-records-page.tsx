'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import type { PersonalRecordWithLift } from '@/lib/database.types'
import { formatLiftDate } from '@/lib/mock-pr-data'
import { formatWeightKg, type WeightUnit } from '@/lib/units'

type PersonalRecordsPageClientProps = {
  current: PersonalRecordWithLift[]
  history: PersonalRecordWithLift[]
  unit: WeightUnit
}

function groupByMuscle(
  records: PersonalRecordWithLift[],
  otherLabel: string,
) {
  const groups = new Map<string, PersonalRecordWithLift[]>()
  for (const record of records) {
    const key = record.lift_types?.muscle_group?.trim() || otherLabel
    const list = groups.get(key) ?? []
    list.push(record)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([muscle, items]) => [
      muscle,
      [...items].sort(
        (a, b) =>
          (a.lift_types?.name ?? '').localeCompare(b.lift_types?.name ?? '') ||
          b.weight - a.weight,
      ),
    ] as const)
    .sort(([a], [b]) => a.localeCompare(b))
}

export function PersonalRecordsPageClient({
  current,
  history,
  unit,
}: PersonalRecordsPageClientProps) {
  const t = useTranslations('records')
  const tCommon = useTranslations('common')
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const [openLiftIds, setOpenLiftIds] = useState<Set<string>>(new Set())

  const historyByLift = useMemo(() => {
    const map = new Map<string, PersonalRecordWithLift[]>()
    for (const row of history) {
      const key = row.lift_type_id
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [history])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return current
    return current.filter((r) =>
      (r.lift_types?.name ?? '').toLowerCase().includes(q),
    )
  }, [current, query])

  const groups = useMemo(
    () => groupByMuscle(filtered, t('otherGroup')),
    [filtered, t],
  )

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

  const toggleLift = (liftTypeId: string) => {
    setOpenLiftIds((prev) => {
      const next = new Set(prev)
      if (next.has(liftTypeId)) next.delete(liftTypeId)
      else next.add(liftTypeId)
      return next
    })
  }

  if (current.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
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
        {groups.length > 0 && !searching && (
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
        )}
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
                      {t('prCount', { count: items.length })}
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition ${
                      groupOpen ? 'rotate-180 text-gold' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {groupOpen && (
                  <ul className="space-y-0 border-t border-silver/10">
                    {items.map((pr) => {
                      const name = pr.lift_types?.name ?? t('liftFallback')
                      const past = historyByLift.get(pr.lift_type_id) ?? []
                      const liftOpen = openLiftIds.has(pr.lift_type_id)
                      return (
                        <li key={pr.id} className="border-t border-silver/10 first:border-t-0">
                          <button
                            type="button"
                            onClick={() => toggleLift(pr.lift_type_id)}
                            aria-expanded={liftOpen}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition hover:bg-foreground/[0.03]"
                          >
                            <div className="min-w-0">
                              <p className="font-heading text-sm font-semibold text-foreground">
                                {name}
                              </p>
                              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                {formatLiftDate(pr.logged_at)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <div className="text-end">
                                <p className="font-heading text-base font-bold tabular-nums text-gold">
                                  {formatWeightKg(pr.weight, unit)}
                                </p>
                                <p className="text-[10px] tracking-[0.14em] tabular-nums text-muted-foreground">
                                  {t('reps', { count: pr.reps })}
                                </p>
                              </div>
                              <ChevronDown
                                className={`size-4 text-muted-foreground transition ${
                                  liftOpen ? 'rotate-180' : ''
                                }`}
                                aria-hidden="true"
                              />
                            </div>
                          </button>
                          {liftOpen && (
                            <div className="border-t border-silver/10 bg-background/30 px-4 py-3">
                              {past.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  {t('noEarlier')}
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {past.map((row) => (
                                    <li
                                      key={row.id}
                                      className="flex items-center justify-between gap-3 text-sm"
                                    >
                                      <span className="tabular-nums text-muted-foreground">
                                        {formatLiftDate(row.logged_at)}
                                      </span>
                                      <span className="tabular-nums text-muted-foreground">
                                        {formatWeightKg(row.weight, unit)} ×{' '}
                                        {row.reps}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
