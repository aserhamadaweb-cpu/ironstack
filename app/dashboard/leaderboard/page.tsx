import { redirect } from 'next/navigation'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { LeaderboardPageClient } from '@/components/leaderboard-page'
import { PageError } from '@/components/page-states'
import { getLeaderboard, getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Leaderboard — IRONSTACK',
  description: 'Streak and best-lift rankings across IronStack.',
}

export default async function LeaderboardPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login?next=/dashboard/leaderboard')

  const [profileResult, boardResult] = await Promise.all([
    getProfile(userId),
    getLeaderboard({ limit: 100 }),
  ])

  if (boardResult.error) {
    return (
      <>

        <main className="mx-auto max-w-3xl px-4 py-10">
          <PageError message={boardResult.error} />
        </main>
      </>
    )
  }

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'
  const unit = profileResult.data?.preferred_unit ?? 'kg'

  return (
    <>

      <OfflineConnectionGate feature="leaderboard">
        <main>
          <LeaderboardPageClient
            rows={boardResult.data ?? []}
            currentUserId={userId}
            unit={unit}
          />
        </main>
      </OfflineConnectionGate>
    </>
  )
}
