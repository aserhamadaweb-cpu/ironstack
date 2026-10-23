'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { EarnedAchievement } from '@/lib/achievements'

type ProfileAchievementsProps = {
  achievements: EarnedAchievement[]
  isSelf: boolean
}

const PROFILE_ACHIEVEMENT_LIMIT = 3

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
  const featured = achievements.slice(0, PROFILE_ACHIEVEMENT_LIMIT)

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

      {featured.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-silver/20 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t('emptyTitle')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSelf ? t('emptyBodySelf') : t('emptyBodyOther')}
          </p>
        </div>
      ) : (
        <ul
          className={`mt-5 grid gap-3 ${
            featured.length === 1
              ? 'max-w-xs grid-cols-1'
              : featured.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
          }`}
        >
          {featured.map((item) => (
            <li key={item.id}>
              <div
                tabIndex={0}
                title={`${item.description} · ${formatEarnedAt(item.earned_at)}`}
                className="group relative flex h-full flex-col items-center gap-2 rounded-2xl border border-gold/25 bg-gold-tint/40 px-3 py-4 text-center transition hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
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
      )}
    </section>
  )
}
