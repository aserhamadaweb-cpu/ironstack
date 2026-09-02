import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ScrollText } from 'lucide-react'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { CoachActivityList } from '@/components/coach-activity-list'
import { DashboardNav } from '@/components/dashboard-nav'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { EmptyState } from '@/components/page-states'
import { listAgentAuditEntries } from '@/lib/ai/agent/audit'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Coach activity — IRONSTACK',
  description: 'Every change the AI coach made on your behalf.',
}

export default async function CoachActivityPage() {
  const t = await getTranslations('coach')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, entries] = await Promise.all([
    getProfile(userId),
    listAgentAuditEntries(userId, 100),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        profileHref={profileHref(profileResult.data?.username, userId)}
        isGuest={profileResult.data?.is_guest === true}
      />
      <OfflineConnectionGate feature="coach">
      <GuestPageGate reason="aiCoach" returnPath="/dashboard/ai-coach/activity">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <BackToTrainLink />
        <header>
          <p className="section-kicker">{t('activityKicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('activityTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('activityIntro')}</p>
        </header>

        {entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t('activityEmpty')}
            body={t('activityEmptyBody')}
            actionLabel={t('openChat')}
            actionHref="/dashboard/ai-coach/chat"
            tone="gold"
          />
        ) : (
          <CoachActivityList entries={entries} />
        )}
      </main>
      </GuestPageGate>
      </OfflineConnectionGate>
    </>
  )
}
