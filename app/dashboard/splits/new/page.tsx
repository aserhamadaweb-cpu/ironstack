import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { CreateSplitChoice } from '@/components/create-split-choice'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export async function generateMetadata() {
  const t = await getTranslations('createSplitChoice')
  return {
    title: `${t('title')} — IRONSTACK`,
    description: t('subtitle'),
  }
}

type Params = { searchParams: Promise<{ home?: string }> }

export default async function CreateSplitChoicePage({ searchParams }: Params) {
  const { home } = await searchParams
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const t = await getTranslations('createSplitChoice')
  const tCommon = await getTranslations('common')
  const profileResult = await getProfile(userId)
  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')

  return (
    <>

      <OfflineConnectionGate feature="splitsManage">
        <GuestPageGate reason="createSplit" returnPath="/dashboard/splits/new">
        <main className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip px-4 py-6 sm:px-6 sm:py-8">
          <BackToTrainLink />
          <header>
            <p className="section-kicker">{t('kicker')}</p>
            <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
          </header>
          <CreateSplitChoice homeLibrary={home === '1'} />
        </main>
        </GuestPageGate>
      </OfflineConnectionGate>
    </>
  )
}
