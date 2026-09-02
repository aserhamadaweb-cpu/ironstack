import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { LeaderboardPageClient } from '@/components/leaderboard-page'
import { PageError } from '@/components/page-states'
import { getLeaderboard, getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
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
        <DashboardNav
          userName={profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'}
          initials={initialsFrom(
            profileResult.data?.display_name || email?.split('@')[0] || 'A',
          )}
          profileHref={profileHref(profileResult.data?.username, userId)}
          avatarUrl={profileResult.data?.avatar_url}
        />
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
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        profileHref={profileHref(profileResult.data?.username, userId)}
      />
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
