import { redirect } from 'next/navigation'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { DashboardNav } from '@/components/dashboard-nav'
import { HomeWorkoutsClient } from '@/components/home-workouts-client'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'
import { getProfile, getSplitsForUser } from '@/lib/data/queries'
import { resolveSplitRecommendations } from '@/lib/data/split-recommendations-server'

export const metadata = {
  title: 'Home Workouts — IRONSTACK',
  description:
    'Train at home with bodyweight, bands, dumbbells, and kettlebells from the IronStack exercise library.',
}

export default async function HomeWorkoutsPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, splitsResult, recommendationsBundle] = await Promise.all([
    getProfile(userId),
    getSplitsForUser(userId).catch(() => ({ data: [] as never[], error: null })),
    resolveSplitRecommendations(),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'
  const yourSplits = (splitsResult.data ?? [])
    .filter((split) => split.user_id === userId && !split.is_system)
    .map((split) => ({
      id: split.id,
      name: split.name,
      days: split.days_per_week,
      focus: split.category || '',
    }))

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        profileHref={profileHref(profileResult.data?.username, userId)}
        isGuest={profileResult.data?.is_guest === true}
      />
      <OfflineConnectionGate feature="homeWorkouts">
        <main
          data-tour="page-home-workouts"
          className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
        >
          <BackToTrainLink className="mb-2" />
          <HomeWorkoutsClient
            yourSplits={yourSplits}
            recommendedSplits={recommendationsBundle.recommendations.slice(0, 3)}
            recommendedSplitsError={recommendationsBundle.error}
            isGuest={profileResult.data?.is_guest === true}
          />
        </main>
      </OfflineConnectionGate>
    </>
  )
}
