'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { StreakFlame } from '@/components/streak-flame'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'

export type LeaderboardRow = {
  userId: string
  displayName: string
  username: string | null
  avatarUrl: string | null
  currentStreak: number
  bestLiftLabel: string | null
}

type LeaderboardSectionProps = {
  currentUserId: string
  globalRows: LeaderboardRow[]
  friendsRows: LeaderboardRow[]
  friendCount: number
  /** Guests have no friends circle — show global only. */
  hideFriendsTab?: boolean
}

type Scope = 'friends' | 'global'

export function LeaderboardSection({
  currentUserId,
  globalRows,
  friendsRows,
  friendCount,
  hideFriendsTab = false,
}: LeaderboardSectionProps) {
  const t = useTranslations('leaderboard')
  const tCommon = useTranslations('common')
  const [scope, setScope] = useState<Scope>(
    hideFriendsTab ? 'global' : 'friends',
  )
  const activeScope = hideFriendsTab ? 'global' : scope
  const rows = activeScope === 'friends' ? friendsRows : globalRows

  return (
    <section className="is-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">{t('sectionKicker')}</p>
          <h2 className="font-heading mt-1 text-xl font-bold text-headline">
            {t('sectionTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('sectionSubtitle')}
          </p>
        </div>

        {!hideFriendsTab && (
        <div
          className="inline-flex rounded-full border border-silver/15 bg-background/60 p-1"
          role="tablist"
          aria-label={t('scopeLabel')}
        >
          {(
            [
              { id: 'friends' as const, label: t('friends') },
              { id: 'global' as const, label: t('global') },
            ] as const
          ).map((tab) => {
            const active = scope === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(tab.id)}
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
        )}
      </div>

      {activeScope === 'friends' && friendCount === 0 ? (
        <EmptyState
          icon={Users}
          title={t('noFriends')}
          body={t('noFriendsBody')}
          tone="silver"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('quiet')}
          body={t('quietStreaksBody')}
          actionLabel={tCommon('openWorkout')}
          actionHref="/dashboard/workout"
          tone="gold"
        />
      ) : (
        <ol className="space-y-2.5">
          {rows.map((row, index) => {
            const isYou = row.userId === currentUserId
            const rank = index + 1
            const name = row.displayName || row.username || tCommon('athlete')
            const href = profileHref(row.username, row.userId)
            const content = (
              <>
                <span
                  className={`w-7 shrink-0 text-center font-heading text-sm font-bold tabular-nums ${
                    isYou ? 'text-gold' : 'text-muted-foreground'
                  }`}
                >
                  {rank}
                </span>

                <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-silver/20 bg-card text-xs font-bold text-gold">
                  {row.avatarUrl ? (
                    <Image
                      src={row.avatarUrl}
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
                  <p className="truncate font-heading text-sm font-semibold text-foreground sm:text-base">
                    {name}
                    {isYou && (
                      <span className="ms-2 text-[10px] font-semibold tracking-[0.14em] text-gold">
                        {t('you')}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                    {row.bestLiftLabel ?? t('noPrYet')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1">
                  <StreakFlame active={row.currentStreak > 0} className="size-5" />
                  <span className="font-heading text-sm font-bold tabular-nums text-gold">
                    {row.currentStreak}
                  </span>
                </div>
              </>
            )
            return (
              <li key={row.userId}>
                {href ? (
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-start transition hover:border-gold/30 sm:gap-4 sm:px-4 ${
                      isYou
                        ? 'border-gold/40 bg-gold/[0.08] shadow-[0_0_24px_-12px_color-mix(in_srgb,var(--gold)_40%,transparent)]'
                        : 'border-silver/10 bg-background/40'
                    }`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-start sm:gap-4 sm:px-4 ${
                      isYou
                        ? 'border-gold/40 bg-gold/[0.08] shadow-[0_0_24px_-12px_color-mix(in_srgb,var(--gold)_40%,transparent)]'
                        : 'border-silver/10 bg-background/40'
                    }`}
                  >
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-5 border-t border-silver/10 pt-4">
        <Link
          href="/dashboard/leaderboard"
          className="btn-pill btn-pill-ghost inline-flex min-h-11 items-center gap-1 px-0 text-xs"
        >
          {t('viewFull')}
          <ChevronRight className="size-3.5 rtl-flip" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
