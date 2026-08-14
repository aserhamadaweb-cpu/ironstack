'use client'

import Link from 'next/link'
import { ChevronRight, Swords } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ChallengeWithRelations } from '@/lib/database.types'
import { formatWeightKg, type WeightUnit } from '@/lib/units'

type HomeChallengesCardProps = {
  activeCount: number
  pendingIncoming: number
  latest: ChallengeWithRelations | null
  currentUserId: string
  unit: WeightUnit
}

export function HomeChallengesCard({
  activeCount,
  pendingIncoming,
  latest,
  currentUserId,
  unit,
}: HomeChallengesCardProps) {
  const t = useTranslations('home')

  const other =
    latest &&
    (latest.creator_id === currentUserId ? latest.opponent : latest.creator)
  const otherName = other?.display_name || other?.username
  const liftName = latest?.lift_types?.name

  let summary = t('challengesEmpty')
  if (pendingIncoming > 0) {
    summary = t('challengesPending', { count: pendingIncoming })
  } else if (activeCount > 0 && latest && liftName) {
    summary = t('challengesActiveSummary', {
      count: activeCount,
      lift: liftName,
      opponent: otherName || t('challengesOpponentFallback'),
      target: formatWeightKg(latest.target_weight, unit),
    })
  } else if (activeCount > 0) {
    summary = t('challengesActive', { count: activeCount })
  } else if (latest && liftName) {
    summary = t('challengesLatest', {
      lift: liftName,
      opponent: otherName || t('challengesOpponentFallback'),
    })
  }

  return (
    <section className="is-panel p-5 sm:p-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker">{t('challengesKicker')}</p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-headline">
            {t('challengesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('challengesBody')}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border chip-amber">
          <Swords className="size-5" aria-hidden="true" />
        </div>
      </div>

      <p className="text-sm text-foreground">{summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {activeCount > 0 && (
          <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-gold">
            {t('challengesActiveBadge', { count: activeCount })}
          </span>
        )}
        {pendingIncoming > 0 && (
          <span className="rounded-full border border-heat/35 bg-heat/10 px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-heat">
            {t('challengesPendingBadge', { count: pendingIncoming })}
          </span>
        )}
      </div>

      <Link
        href="/dashboard/challenges"
        className="btn-pill btn-pill-ghost mt-5 inline-flex min-h-11 items-center gap-1 px-0 text-xs"
      >
        {t('challengesOpen')}
        <ChevronRight className="size-3.5 rtl-flip" aria-hidden="true" />
      </Link>
    </section>
  )
}
