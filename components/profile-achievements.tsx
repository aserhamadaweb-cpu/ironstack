'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EarnedAchievement } from '@/lib/achievements'
import { reorderAchievementsAction } from '@/lib/data/achievements'

type ProfileAchievementsProps = {
  achievements: EarnedAchievement[]
  isSelf: boolean
}

function formatEarnedAt(iso: string) {
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

export function ProfileAchievements({
  achievements,
  isSelf,
}: ProfileAchievementsProps) {
  const t = useTranslations('achievements')
  const [items, setItems] = useState(achievements)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(achievements)
  }, [achievements])

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
        setItems(achievements)
      }
    })
  }

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker">{t('kicker')}</p>
          <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
            {t('profileTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSelf ? t('profileSubtitleSelf') : t('profileSubtitleOther')}
          </p>
        </div>
        {isSelf && (
          <Link
            href="/dashboard/achievements"
            className="text-xs font-semibold tracking-[0.14em] text-gold transition hover:opacity-80"
          >
            {t('viewAll')}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-silver/20 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t('emptyTitle')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSelf ? t('emptyBodySelf') : t('emptyBodyOther')}
          </p>
        </div>
      ) : (
        <>
          {isSelf && items.length > 1 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t('reorderHint')}
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-heat" role="alert">
              {error}
            </p>
          )}
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, index) => (
              <li key={item.id}>
                <div
                  tabIndex={0}
                  title={`${item.description} · ${formatEarnedAt(item.earned_at)}`}
                  className="group relative flex h-full flex-col items-center gap-2 rounded-2xl border border-gold/25 bg-gold-tint/40 px-3 py-4 text-center transition hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  {isSelf && items.length > 1 && (
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
                  {isSelf && items.length > 1 && (
                    <GripVertical
                      className="absolute start-1.5 top-1.5 size-3.5 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-2xl" aria-hidden="true">
                    {item.icon}
                  </span>
                  <p className="text-xs font-semibold leading-snug text-foreground">
                    {item.name}
                  </p>
                  <div className="pointer-events-none absolute inset-x-2 bottom-[calc(100%+0.35rem)] z-10 hidden rounded-xl border border-silver/15 bg-card px-3 py-2 text-start shadow-lg group-hover:block group-focus-within:block">
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-gold">
                      {t('earnedOn', { date: formatEarnedAt(item.earned_at) })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
