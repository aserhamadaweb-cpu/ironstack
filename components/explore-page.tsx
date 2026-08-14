'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Search, Trophy, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { StreakFlame } from '@/components/streak-flame'
import { searchPeopleAction } from '@/lib/data/social-actions'
import type { LeaderboardEntry } from '@/lib/database.types'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { formatLiftLabel, type WeightUnit } from '@/lib/units'

type DiscoverPerson = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  isFollowing: boolean
  isFriend: boolean
  friendshipStatus: string
}

type ExplorePageClientProps = {
  previewRows: LeaderboardEntry[]
  currentUserId: string
  unit: WeightUnit
}

export function ExplorePageClient({
  previewRows,
  currentUserId,
  unit,
}: ExplorePageClientProps) {
  const t = useTranslations('explore')
  const tCommon = useTranslations('common')
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<DiscoverPerson[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const rankedPreview = useMemo(() => previewRows.slice(0, 8), [previewRows])

  const runSearch = (value: string) => {
    setQuery(value)
    const q = value.trim()
    if (q.length < 1) {
      setPeople([])
      setError(null)
      return
    }
    startTransition(async () => {
      const result = await searchPeopleAction(q)
      if (result.error) {
        setError(result.error)
        setPeople([])
        return
      }
      setError(null)
      setPeople(result.people as DiscoverPerson[])
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <p className="section-kicker">{t('kicker')}</p>
        <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section>
        <label className="relative block">
          <span className="sr-only">{t('searchLabel')}</span>
          <Search
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-12 w-full rounded-xl border border-silver/15 bg-background/70 pe-3 ps-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-4">
          {query.trim().length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('searchHint')}</p>
          ) : pending ? (
            <p className="text-sm text-muted-foreground">{t('searching')}</p>
          ) : people.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('noMatches')}
              body={t('noMatchesBody')}
              tone="silver"
            />
          ) : (
            <ul className="space-y-2">
              {people.map((person) => {
                const name =
                  person.display_name ||
                  person.username ||
                  tCommon('athlete')
                return (
                  <li key={person.id}>
                    <Link
                      href={profileHref(person.username, person.id)}
                      className="is-row flex w-full items-center gap-3 px-3 py-3 text-start"
                    >
                      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-silver/20 bg-card text-xs font-bold text-gold">
                        {person.avatar_url ? (
                          <Image
                            src={person.avatar_url}
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
                        </p>
                        {person.username && (
                          <p className="truncate text-xs text-muted-foreground">
                            @{person.username}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
              {t('boardPreview')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('boardPreviewHint')}
            </p>
          </div>
          <Link
            href="/dashboard/leaderboard"
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold tracking-[0.16em] text-gold transition hover:text-gold/80"
          >
            {t('viewAll')}
            <ChevronRight className="size-3.5 rtl-flip" aria-hidden="true" />
          </Link>
        </div>
        {rankedPreview.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={t('noRankings')}
            body={t('noRankingsBody')}
            tone="gold"
          />
        ) : (
          <ol className="space-y-2">
            {rankedPreview.map((row, index) => {
              const isYou = row.user_id === currentUserId
              const name =
                row.display_name || row.username || tCommon('athlete')
              const lift = formatLiftLabel(
                row.best_lift_name,
                row.best_lift_weight,
                row.best_lift_reps,
                unit,
              )
              return (
                <li key={row.user_id}>
                  <Link
                    href={profileHref(row.username, row.user_id)}
                    className={`is-row flex w-full items-center gap-3 px-3 py-3 text-start ${
                      isYou ? 'border-gold/30 bg-gold/[0.05]' : ''
                    }`}
                  >
                    <span className="w-6 text-center text-xs font-bold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-silver/20 bg-card text-[10px] font-bold text-gold">
                      {row.avatar_url ? (
                        <Image
                          src={row.avatar_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        initialsFrom(name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {lift ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-gold">
                      <StreakFlame
                        active={(row.current_streak ?? 0) > 0}
                        className="size-4"
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
      </section>
    </div>
  )
}
