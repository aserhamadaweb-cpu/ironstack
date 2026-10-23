import { LeaderboardSection } from '@/components/leaderboard-section'
import { TrainingCircleFeed } from '@/components/training-circle-feed'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getAcceptedFriends, getLeaderboard } from '@/lib/data/queries'
import { formatLiftLabel } from '@/lib/units'
import type { WeightUnit } from '@/lib/units'

type HomeCommunityProps = {
  userId: string
  unit: WeightUnit
  isGuest: boolean
}

/** Friends + leaderboard stream after Home's first paint. */
export async function HomeCommunity({
  userId,
  unit,
  isGuest,
}: HomeCommunityProps) {
  let friendsResult: Awaited<ReturnType<typeof getAcceptedFriends>> = {
    data: [],
    error: null,
  }
  let globalResult: Awaited<ReturnType<typeof getLeaderboard>> = {
    data: [],
    error: null,
  }

  try {
    const fetched = await Promise.all([
      getAcceptedFriends(userId),
      getLeaderboard({ limit: 20 }),
    ])
    friendsResult = fetched[0]
    globalResult = fetched[1]
  } catch {
    /* Degraded social — Home chrome already painted. */
  }

  const friends = friendsResult.data ?? []
  const friendIds = friends.map(({ profile }) => profile.id)

  let friendsBoardResult: Awaited<ReturnType<typeof getLeaderboard>> = {
    data: [],
    error: null,
  }
  if (friendIds.length > 0 && !isGuest) {
    try {
      friendsBoardResult = await getLeaderboard({
        userIds: [...friendIds, userId],
        limit: 20,
      })
    } catch {
      friendsBoardResult = { data: [], error: null }
    }
  }

  const friendAvatars = friends.map(({ profile: friend }, index) => {
    const name = friend.display_name || friend.username || 'Friend'
    const tones = [
      'border chip-amber',
      'border chip-blue',
      'border chip-green',
    ]
    return {
      id: friend.id,
      name,
      initials: initialsFrom(name),
      tone: tones[index % tones.length],
      username: friend.username,
      avatarUrl: friend.avatar_url,
    }
  })

  const mapRow = (row: NonNullable<typeof globalResult.data>[number]) => ({
    userId: row.user_id,
    displayName: row.display_name || row.username || 'Athlete',
    username: row.username,
    avatarUrl: row.avatar_url,
    currentStreak: Number(row.current_streak) || 0,
    bestLiftLabel: formatLiftLabel(
      row.best_lift_name,
      row.best_lift_weight,
      row.best_lift_reps,
      unit,
    ),
  })

  const friendsRows =
    friendIds.length === 0 ? [] : (friendsBoardResult.data ?? []).map(mapRow)

  return (
    <>
      {!isGuest && (
        <section className="mb-8 sm:mb-10" data-tour="home-social">
          <TrainingCircleFeed friends={friendAvatars} />
        </section>
      )}
      <section className="mb-8 sm:mb-10" data-tour="home-leaderboard">
        <LeaderboardSection
          currentUserId={userId}
          globalRows={(globalResult.data ?? []).map(mapRow)}
          friendsRows={isGuest ? [] : friendsRows}
          friendCount={isGuest ? 0 : friendIds.length}
          hideFriendsTab={isGuest}
        />
      </section>
    </>
  )
}
