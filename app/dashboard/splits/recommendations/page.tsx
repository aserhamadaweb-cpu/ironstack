import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { DashboardNav } from '@/components/dashboard-nav'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { SplitRecommendationsPanel } from '@/components/split-recommendations-panel'
import { getProfile } from '@/lib/data/queries'
import { resolveSplitRecommendations } from '@/lib/data/split-recommendations-server'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Program Recommendations — IRONSTACK',
  description: 'Personalized training split recommendations.',
}

export default async function SplitRecommendationsPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const t = await getTranslations('splitRecommendations')
  const [profileResult, bundle] = await Promise.all([
    getProfile(userId),
    resolveSplitRecommendations(),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        profileHref={profileHref(profileResult.data?.username, userId)}
      />
      <OfflineConnectionGate feature="splitsManage">
      <GuestPageGate reason="createSplit" returnPath="/dashboard/splits/recommendations">
      <main className="mx-auto min-w-0 max-w-2xl space-y-6 overflow-x-clip px-4 py-6 sm:px-6">
        <BackToTrainLink />
        <p className="section-kicker">{t('kicker')}</p>
        <SplitRecommendationsPanel
          mode="standalone"
          initialRecommendations={bundle.recommendations}
          fingerprint={bundle.fingerprint}
          initialError={bundle.error}
        />
      </main>
      </GuestPageGate>
      </OfflineConnectionGate>
    </>
  )
}
