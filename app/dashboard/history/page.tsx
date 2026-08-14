import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { DashboardNav } from '@/components/dashboard-nav'
import { EmptyState } from '@/components/page-states'
import { getCompletedSessions, getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import {
  formatDuration,
  formatSessionDate,
} from '@/lib/session-store'
import { getAuthIdentity } from '@/lib/supabase/server'
import { formatVolumeKg } from '@/lib/units'

export const metadata = {
  title: 'History — IRONSTACK',
  description: 'Your completed training sessions.',
}

export default async function HistoryPage() {
  const t = await getTranslations('history')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, sessionsResult] = await Promise.all([
    getProfile(userId),
    getCompletedSessions(userId, 80),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')
  const unit = profileResult.data?.preferred_unit ?? 'kg'
  const sessions = sessionsResult.data ?? []

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        profileHref={profileHref(profileResult.data?.username, userId)}
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
        <header>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        {sessionsResult.error && (
          <p role="alert" className="text-sm text-destructive">
            {sessionsResult.error}
          </p>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            icon={History}
            title={t('empty')}
            body={t('emptyBody')}
            actionLabel={tCommon('openWorkout')}
            actionHref="/dashboard/workout"
            tone="heat"
          />
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const when = session.finished_at ?? session.started_at
              const splitName = session.splits?.name ?? t('openSession')
              const dayName = session.split_days?.name
              const completed = session.total_sets_completed ?? 0
              const skipped = session.total_sets_skipped ?? 0
              return (
                <li key={session.id}>
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="is-row flex w-full flex-col gap-2 px-4 py-4 text-start sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-heading text-base font-semibold text-foreground">
                        {splitName}
                        {dayName ? (
                          <span className="text-muted-foreground">
                            {' '}
                            · {dayName}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {formatSessionDate(when)}
                        {session.duration_seconds != null
                          ? ` · ${formatDuration(session.duration_seconds)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-3 text-xs sm:flex-col sm:items-end sm:gap-1">
                      <span className="font-semibold tabular-nums text-gold">
                        {formatVolumeKg(session.total_volume, unit)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {t('done', { count: completed })}
                        {skipped > 0
                          ? ` · ${t('skipped', { count: skipped })}`
                          : ''}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
