'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EarnedAchievement } from '@/lib/achievements'
import { ACHIEVEMENT_CATEGORIES } from '@/lib/achievements'
import { reorderAchievementsAction } from '@/lib/data/achievements'
import type { Achievement, UserAchievement } from '@/lib/database.types'

type AchievementsCatalogClientProps = {
  catalog: Achievement[]
  earnedRows: UserAchievement[]
  showcase: EarnedAchievement[]
}

function formatEarnedAt(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export function AchievementsCatalogClient({
  catalog,
  earnedRows,
  showcase,
}: AchievementsCatalogClientProps) {
  const t = useTranslations('achievements')
  const [items, setItems] = useState(showcase)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(showcase)
  }, [showcase])

  const earnedById = useMemo(() => {
    const map = new Map<string, UserAchievement>()
    for (const row of earnedRows) map.set(row.achievement_id, row)
    return map
  }, [earnedRows])

  const byCategory = useMemo(() => {
    const map = new Map<string, Achievement[]>()
    for (const achievement of catalog) {
      const list = map.get(achievement.category) ?? []
      list.push(achievement)
      map.set(achievement.category, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [catalog])

  const earnedCount = earnedRows.length
  const totalCount = catalog.length

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= items.length) return
    const next = [...items]
    const [removed] = next.splice(index, 1)
    next.splice(nextIndex, 0, removed)
    setItems(next)
    setError(null)
    startTransition(async () => {
      const result = await reorderAchievementsAction(next.map((a) => a.id))
      if (!result.ok) {
        setError(result.error)
        setItems(showcase)
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="is-panel p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">{t('progressHint')}</p>
        <p className="mt-2 font-heading text-3xl font-bold tabular-nums text-foreground">
          <span className="text-gold">{earnedCount}</span>
          <span className="text-muted-foreground"> / {totalCount}</span>
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{
              width: `${totalCount ? Math.round((earnedCount / totalCount) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {items.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="section-kicker">{t('showcaseKicker')}</p>
            <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
              {t('showcaseTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('showcaseBody')}
            </p>
          </div>
          {error && (
            <p className="text-xs text-heat" role="alert">
              {error}
            </p>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, index) => (
              <li key={item.id}>
                <div className="relative flex h-full flex-col items-center gap-2 rounded-2xl border border-gold/25 bg-gold-tint/40 px-3 py-4 text-center">
                  {items.length > 1 && (
                    <div className="absolute end-1.5 top-1.5 flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={pending || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={t('moveUp')}
                        className="rounded-md p-0.5 text-muted-foreground transition hover:bg-gold/15 hover:text-gold disabled:opacity-30"
                      >
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={pending || index === items.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={t('moveDown')}
                        className="rounded-md p-0.5 text-muted-foreground transition hover:bg-gold/15 hover:text-gold disabled:opacity-30"
                      >
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <span className="text-2xl" aria-hidden="true">
                    {item.icon}
                  </span>
                  <p className="text-xs font-semibold leading-snug text-foreground">
                    {item.name}
                  </p>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-gold">
                    {t('earnedOn', {
                      date: formatEarnedAt(item.earned_at) ?? '',
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ACHIEVEMENT_CATEGORIES.map((category) => {
        const list = byCategory.get(category) ?? []
        if (list.length === 0) return null

        return (
          <section key={category} className="space-y-4">
            <div>
              <p className="section-kicker">{t(`category.${category}`)}</p>
              <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
                {t(`categoryTitle.${category}`)}
              </h2>
            </div>

            <div className="space-y-3">
              {list.map((achievement) => {
                const earned = earnedById.get(achievement.id)
                const isEarned = Boolean(earned)
                return (
                  <div
                    key={achievement.id}
                    className={`flex items-start gap-3 rounded-2xl border p-4 sm:p-5 ${
                      isEarned
                        ? 'border-gold/30 bg-gold-tint/30'
                        : 'border-silver/10 bg-card/40 opacity-70'
                    }`}
                  >
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-xl ${
                        isEarned
                          ? 'border-gold/40 bg-gold/10'
                          : 'border-silver/15 bg-background/50 grayscale'
                      }`}
                      aria-hidden="true"
                    >
                      {achievement.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {achievement.name}
                        </p>
                        {isEarned ? (
                          <span className="rounded-full border border-gold/35 bg-gold/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-gold">
                            {t('earned')}
                          </span>
                        ) : (
                          <span className="rounded-full border border-silver/20 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-muted-foreground">
                            {t('locked')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {achievement.description}
                      </p>
                      {isEarned && earned?.earned_at && (
                        <p className="mt-1.5 text-[10px] font-semibold tracking-[0.12em] text-gold">
                          {t('earnedOn', {
                            date: formatEarnedAt(earned.earned_at) ?? '',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
