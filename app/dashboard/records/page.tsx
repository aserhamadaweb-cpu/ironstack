import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DashboardNav } from '@/components/dashboard-nav'
import { PersonalRecordsPageClient } from '@/components/personal-records-page'
import { PageError } from '@/components/page-states'
import { getPersonalRecordsBoard, getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Personal Records — IRONSTACK',
  description: 'Your current PRs and lift history.',
}

export default async function PersonalRecordsPage() {
  const t = await getTranslations('records')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, boardResult] = await Promise.all([
    getProfile(userId),
    getPersonalRecordsBoard(userId),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')
  const unit = profileResult.data?.preferred_unit ?? 'kg'

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

        {boardResult.error ? (
          <PageError message={boardResult.error} />
        ) : (
          <PersonalRecordsPageClient
            current={boardResult.data?.current ?? []}
            history={boardResult.data?.history ?? []}
            unit={unit}
          />
        )}
      </main>
    </>
  )
}
