import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { HistorySessionList } from '@/components/history-session-list'
import { getCompletedSessions, getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

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
  const unit = profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'
  const sessions = (sessionsResult.data ?? []).map((session) => {
    const when = session.finished_at ?? session.started_at
    return {
      id: session.id,
      splitName: session.splits?.name ?? t('openSession'),
      dayName: session.split_days?.name ?? null,
      when,
      durationSeconds: session.duration_seconds,
      totalVolume: session.total_volume ?? 0,
      completed: session.total_sets_completed ?? 0,
      skipped: session.total_sets_skipped ?? 0,
    }
  })

  return (
    <>

      <main
        data-tour="page-history"
        className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <BackToTrainLink />

        <header>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>
        <HistorySessionList
          initial={sessions}
          unit={unit}
          error={sessionsResult.error}
        />
      </main>
    </>
  )
}
