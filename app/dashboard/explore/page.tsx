import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { ExplorePageClient } from '@/components/explore-page'
import { getLeaderboard, getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Explore — IRONSTACK',
  description: 'Find people and preview the leaderboard.',
}

export default async function ExplorePage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, boardResult] = await Promise.all([
    getProfile(userId),
    getLeaderboard({ limit: 12, orderBy: 'streak' }),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        profileHref={profileHref(profileResult.data?.username, userId)}
      />
      <main className="pb-24 md:pb-8">
        <ExplorePageClient
          previewRows={boardResult.data ?? []}
          currentUserId={userId}
          unit={profileResult.data?.preferred_unit ?? 'kg'}
        />
      </main>
    </>
  )
}
