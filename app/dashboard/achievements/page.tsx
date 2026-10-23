import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AchievementsCatalogClient } from '@/components/achievements-catalog-page'
import { BackToTrainLink } from '@/components/back-to-train-link'
import {
  listAchievementsCatalog,
  listEarnedAchievementsForProfile,
  listRawUserAchievementRows,
} from '@/lib/data/achievements'
import { getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Achievements — IRONSTACK',
  description: 'Track every IronStack achievement and what to unlock next.',
}

export default async function AchievementsPage() {
  const t = await getTranslations('achievements')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, catalog, earnedRows, showcase] = await Promise.all([
    getProfile(userId),
    listAchievementsCatalog(),
    listRawUserAchievementRows(userId),
    listEarnedAchievementsForProfile(userId),
  ])

  const displayName =
    profileResult.data?.display_name ||
    email?.split('@')[0] ||
    tCommon('athlete')

  return (
    <>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <BackToTrainLink />
        <header>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('pageTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </header>

        <AchievementsCatalogClient
          catalog={catalog}
          earnedRows={earnedRows}
          showcase={showcase}
        />
      </main>
    </>
  )
}
