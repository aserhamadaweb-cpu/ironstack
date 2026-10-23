import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { SplitAiBuilderStandalone } from '@/components/split-ai-builder-standalone'
import { getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export async function generateMetadata() {
  const t = await getTranslations('splitRecommendations')
  return {
    title: `${t('aiBuilderTitle')} — IRONSTACK`,
    description: t('aiBuilderBody'),
  }
}

export default async function SplitAiBuilderPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const t = await getTranslations('splitRecommendations')
  const tCommon = await getTranslations('common')
  const profileResult = await getProfile(userId)
  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')

  return (
    <>

      <OfflineConnectionGate feature="splitsManage">
        <GuestPageGate reason="createSplit" returnPath="/dashboard/splits/ai-builder">
        <main className="mx-auto min-w-0 max-w-2xl space-y-6 overflow-x-clip px-4 py-6 sm:px-6">
          <BackToTrainLink />
          <header>
            <p className="section-kicker">{t('kicker')}</p>
            <h1 className="font-heading mt-1 text-2xl font-bold text-headline">
              {t('aiBuilderTitle')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('aiBuilderBody')}</p>
          </header>
          <SplitAiBuilderStandalone />
        </main>
        </GuestPageGate>
      </OfflineConnectionGate>
    </>
  )
}
