import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { SplitRecommendationsPanel } from '@/components/split-recommendations-panel'
import { getProfile } from '@/lib/data/queries'
import { resolveSplitRecommendations } from '@/lib/data/split-recommendations-server'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Ready Splits — IRONSTACK',
  description: 'Choose a ready-made training split and start without building one yourself.',
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

      <OfflineConnectionGate feature="splitsManage">
      <main className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip px-4 py-6 sm:px-6">
        <BackToTrainLink />
        <p className="section-kicker">{t('kicker')}</p>
        <SplitRecommendationsPanel
          mode="standalone"
          initialRecommendations={bundle.recommendations}
          fingerprint={bundle.fingerprint}
          initialError={bundle.error}
        />
      </main>
      </OfflineConnectionGate>
    </>
  )
}
