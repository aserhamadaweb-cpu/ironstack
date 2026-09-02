import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExerciseBrowseClient } from '@/components/exercise-browse-client'
import { expectedSourceCount } from '@/lib/exercises/catalog'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/queries'

export const metadata = {
  title: 'Exercise Library — IRONSTACK',
  description: 'Browse 1,324 exercises with local thumbnails and animation GIFs.',
}

export default async function ExerciseBrowsePage() {
  const t = await getTranslations('exerciseCatalog')
  const tHome = await getTranslations('homeWorkouts')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const profileResult = await getProfile(userId)
  const exerciseCount = expectedSourceCount()

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        profileHref={profileHref(profileResult.data?.username, userId)}
        isGuest={profileResult.data?.is_guest === true}
      />
      <main
        data-tour="page-exercises"
        className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <BackToTrainLink className="mb-2" />
        <header>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-3xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('subtitle', { count: exerciseCount })}{' '}
            <Link
              href="/dashboard/home-workouts"
              className="font-semibold text-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {tHome('title')}
            </Link>
          </p>
        </header>
        <ExerciseBrowseClient />
      </main>
    </>
  )
}
