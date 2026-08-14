'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { formatSessionDate } from '@/lib/session-store'
import { formatWeightKg } from '@/lib/units'

export type PersonalRecordItem = {
  id: string
  liftName: string
  muscleGroup: string
  weight: number
  reps: number
  loggedAt: string
}

type PersonalRecordsSectionProps = {
  records: PersonalRecordItem[]
  weightUnit?: 'kg' | 'lb'
}

function groupByMuscle(
  records: PersonalRecordItem[],
  otherLabel: string,
) {
  const groups = new Map<string, PersonalRecordItem[]>()
  for (const record of records) {
    const key = record.muscleGroup || otherLabel
    const list = groups.get(key) ?? []
    list.push(record)
    groups.set(key, list)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function PersonalRecordsSection({
  records,
  weightUnit = 'kg',
}: PersonalRecordsSectionProps) {
  const t = useTranslations('records')
  const tCommon = useTranslations('common')
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) => r.liftName.toLowerCase().includes(q))
  }, [records, query])

  const groups = useMemo(
    () => groupByMuscle(filtered, t('otherGroup')),
    [filtered, t],
  )

  // While searching, auto-expand every matching section so results aren't hidden.
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

  const expandAll = () => {
    setOpenGroups(new Set(groups.map(([name]) => name)))
  }

  const collapseAll = () => {
    setOpenGroups(new Set())
  }

  return (
    <section className="is-panel p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker">{t('sectionKicker')}</p>
          <h2 className="font-heading mt-1 text-xl font-bold text-headline">
            {t('sectionTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('sectionSubtitle')}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border chip-amber">
          <Trophy className="size-5" aria-hidden="true" />
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t('empty')}
          body={t('emptyBody')}
          actionLabel={tCommon('openWorkout')}
          actionHref="/dashboard/workout"
          tone="heat"
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
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
                onClick={allOpen ? collapseAll : expandAll}
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
                const open = searching || openGroups.has(muscle)
                return (
                  <div
                    key={muscle}
                    className="overflow-hidden rounded-xl border border-silver/10 bg-background/40"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!searching) toggleGroup(muscle)
                      }}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-start transition-colors hover:bg-gold/[0.04]"
                    >
                      <span className="min-w-0">
                        <span className="font-heading text-sm font-semibold text-foreground">
                          {muscle}
                        </span>
                        <span className="ms-2 text-[10px] tracking-[0.14em] tabular-nums text-muted-foreground">
                          {t('prCount', { count: items.length })}
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                          open ? 'rotate-180 text-gold' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {open && (
                      <ul className="grid grid-cols-2 gap-2 border-t border-silver/10 p-2.5 sm:grid-cols-3 lg:grid-cols-4">
                        {items.map((record) => (
                          <li
                            key={record.id}
                            className="rounded-lg border border-silver/10 bg-card/60 px-2.5 py-2.5"
                          >
                            <p className="line-clamp-2 font-heading text-xs font-semibold leading-snug text-foreground sm:text-[13px]">
                              {record.liftName}
                            </p>
                            <p className="mt-1.5 font-heading text-sm font-bold tabular-nums text-gold">
                              {formatWeightKg(record.weight, weightUnit)}
                            </p>
                            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                              {t('repsShort', { count: record.reps })} ·{' '}
                              {formatSessionDate(record.loggedAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
