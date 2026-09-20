'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { StreakFlame } from '@/components/streak-flame'
import { checkTop10AchievementAction } from '@/lib/data/achievements'
import type { LeaderboardEntry } from '@/lib/database.types'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { formatLiftLabel, type WeightUnit } from '@/lib/units'

type SortMode = 'streak' | 'weight'

type LeaderboardPageClientProps = {
  rows: LeaderboardEntry[]
  currentUserId: string
  unit: WeightUnit
}

export function LeaderboardPageClient({
  rows,
  currentUserId,
  unit,
}: LeaderboardPageClientProps) {
  const t = useTranslations('leaderboard')
  const tCommon = useTranslations('common')
  const [sort, setSort] = useState<SortMode>('streak')

  useEffect(() => {
    if (!currentUserId) return
    void checkTop10AchievementAction(currentUserId)
  }, [currentUserId])

  const ranked = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sort === 'weight') {
        const w =
          (Number(b.best_lift_weight) || 0) - (Number(a.best_lift_weight) || 0)
        if (w !== 0) return w
        return (Number(b.current_streak) || 0) - (Number(a.current_streak) || 0)
      }
      const s =
        (Number(b.current_streak) || 0) - (Number(a.current_streak) || 0)
      if (s !== 0) return s
      return (Number(b.best_lift_weight) || 0) - (Number(a.best_lift_weight) || 0)
    })
    return copy
  }, [rows, sort])

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"
      data-tour="page-leaderboard"
    >
      <BackToTrainLink />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div
          className="inline-flex rounded-full border border-silver/15 bg-background/60 p-1"
          role="tablist"
          aria-label={t('sortLabel')}
        >
          {(
            [
              { id: 'streak' as const, label: t('sortStreak') },
              { id: 'weight' as const, label: t('sortWeight') },
            ] as const
          ).map((tab) => {
            const active = sort === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSort(tab.id)}
                className={`rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${
                  active
                    ? 'bg-gold text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      {ranked.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t('quiet')}
          body={t('quietBody')}
          actionLabel={tCommon('openWorkout')}
          actionHref="/dashboard/workout"
          tone="gold"
        />
      ) : (
        <ol className="space-y-2">
          {ranked.map((row, index) => {
            const isYou = row.user_id === currentUserId
            const name =
              row.display_name || row.username || tCommon('athlete')
            const href = profileHref(row.username, row.user_id)
            const lift = formatLiftLabel(
              row.best_lift_name,
              row.best_lift_weight,
              row.best_lift_reps,
              unit,
            )
            return (
              <li key={row.user_id}>
                <Link
                  href={href}
                  className={`is-row flex w-full items-center gap-3 px-3 py-3 text-start ${
                    isYou
                      ? 'border-gold/35 bg-gold/[0.07] shadow-[0_0_24px_-12px_color-mix(in_srgb,var(--gold)_40%,transparent)]'
                      : ''
                  }`}
                >
                  <span
                    className={`w-7 shrink-0 text-center font-heading text-sm font-bold tabular-nums ${
                      isYou ? 'text-gold' : 'text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-silver/20 bg-card text-xs font-bold text-gold">
                    {row.avatar_url ? (
                      <Image
                        src={row.avatar_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      initialsFrom(name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-semibold text-foreground">
                      {name}
                      {isYou && (
                        <span className="ms-2 text-[10px] font-semibold tracking-[0.14em] text-gold">
                          {t('you')}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {lift ?? t('buildingMomentum')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-gold">
                    <StreakFlame
                      active={(row.current_streak ?? 0) > 0}
                      className="size-5"
                    />
                    <span className="text-sm font-bold tabular-nums">
                      {row.current_streak ?? 0}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
