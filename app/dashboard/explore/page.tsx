import { redirect } from 'next/navigation'
import { ExplorePageClient } from '@/components/explore-page'
import { getLeaderboard, getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Explore — IRONSTACK',
  description: 'Find people and preview the leaderboard.',
}

export default async function ExplorePage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login?next=/dashboard/explore')

  const [profileResult, boardResult] = await Promise.all([
    getProfile(userId),
    getLeaderboard({ limit: 12, orderBy: 'streak' }),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>

      <main>
        <ExplorePageClient
          previewRows={boardResult.data ?? []}
          currentUserId={userId}
          unit={profileResult.data?.preferred_unit ?? 'kg'}
        />
      </main>
    </>
  )
}
