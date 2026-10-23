import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { FriendChallengesPage } from '@/components/friend-challenges-page'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import {
  listLiftTypesForChallenges,
  listMyChallenges,
} from '@/lib/data/challenges'
import { getAcceptedFriends, getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Challenges — IRONSTACK',
  description: 'Challenge friends to hit a lift target and settle it in the gym.',
}

export default async function ChallengesPage() {
  const t = await getTranslations('friendChallenges')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, friendsResult, challenges, lifts] = await Promise.all([
    getProfile(userId),
    getAcceptedFriends(userId),
    listMyChallenges(userId),
    listLiftTypesForChallenges(),
  ])

  const displayName =
    profileResult.data?.display_name ||
    email?.split('@')[0] ||
    tCommon('athlete')

  const friends = (friendsResult.data ?? []).map(({ profile }) => ({
    id: profile.id,
    name: profile.display_name || profile.username || tCommon('friend'),
    username: profile.username,
    avatarUrl: profile.avatar_url,
  }))

  return (
    <>

      <OfflineConnectionGate feature="leaderboard">
      <GuestPageGate reason="challenges" returnPath="/dashboard/challenges">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <BackToTrainLink />
        <header>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        <FriendChallengesPage
          currentUserId={userId}
          challenges={challenges}
          friends={friends}
          lifts={lifts}
          unit={profileResult.data?.preferred_unit ?? 'kg'}
        />
      </main>
      </GuestPageGate>
      </OfflineConnectionGate>
    </>
  )
}
