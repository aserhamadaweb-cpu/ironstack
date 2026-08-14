import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { HomeDashboard } from '@/components/home-dashboard'
import { PageError } from '@/components/page-states'
import {
  getAcceptedFriends,
  getCompletedSessions,
  getLeaderboard,
  getProfile,
} from '@/lib/data/queries'
import { getCachedCoachInsight } from '@/lib/ai/insights'
import { ltrEmbed } from '@/lib/bidi'
import { getChallengesHomeSummary } from '@/lib/data/challenges'
import { initialsFrom } from '@/lib/dashboard-utils'
import { fetchStreakStatus } from '@/lib/data/streak'
import { isSameLocalDay } from '@/lib/session-store'
import { getAuthIdentity } from '@/lib/supabase/server'
import { formatLiftLabel } from '@/lib/units'

export const metadata = {
  title: 'Home — IRONSTACK',
  description:
    'Your IronStack home: community, motivation, and what makes us different.',
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default async function HomePage() {
  const tDays = await getTranslations('days')
  const tHome = await getTranslations('home')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, sessionsResult, friendsResult, globalResult, insight, streakStatus, challengeSummary] =
    await Promise.all([
      getProfile(userId),
      getCompletedSessions(userId, 21),
      getAcceptedFriends(userId),
      getLeaderboard({ limit: 20 }),
      getCachedCoachInsight(userId),
      fetchStreakStatus(userId),
      getChallengesHomeSummary(userId),
    ])

  const friends = friendsResult.data ?? []
  const friendIds = friends.map(({ profile }) => profile.id)

  const friendsBoardResult =
    friendIds.length === 0
      ? { data: [] as NonNullable<typeof globalResult.data>, error: null }
      : await getLeaderboard({
          userIds: [...friendIds, userId],
          limit: 20,
        })

  const error =
    profileResult.error ||
    sessionsResult.error ||
    friendsResult.error ||
    globalResult.error ||
    friendsBoardResult.error

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={error} />
      </main>
    )
  }

  const profile = profileResult.data
  const sessions = sessionsResult.data ?? []
  const tCommon = await getTranslations('common')

  const displayName =
    profile?.display_name || email?.split('@')[0] || tCommon('athlete')
  const username = profile?.username || undefined

  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const weekActivity = DAY_KEYS.map((key, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const done = sessions.some((session) =>
      isSameLocalDay(new Date(session.started_at), date),
    )
    return { day: tDays(key), done }
  })

  const weekSessionCount = weekActivity.filter((d) => d.done).length

  const streak = streakStatus.streakDays
  const streakHoursLeft = streakStatus.hoursLeft

  const latest = sessions[0] ?? null
  let lastSessionCaption = tHome('noSessionsYet')
  if (latest) {
    const date = ltrEmbed(
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(latest.started_at)),
    )
    const name = ltrEmbed(
      latest.split_days?.name
        ? `${latest.split_days.name} · ${latest.splits?.name ?? tHome('splitFallback')}`
        : (latest.splits?.name ?? tHome('workoutFallback')),
    )
    lastSessionCaption = tHome('lastSession', { name, date })
  }

  const friendAvatars = friends.map(({ profile: friend }, index) => {
    const name = friend.display_name || friend.username || tCommon('friend')
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

  const unit = profileResult.data?.preferred_unit ?? 'kg'

  const mapRow = (row: NonNullable<typeof globalResult.data>[number]) => ({
    userId: row.user_id,
    displayName: row.display_name || row.username || tCommon('athlete'),
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
    <HomeDashboard
      displayName={displayName}
      email={email ?? ''}
      username={username}
      weekActivity={weekActivity}
      weekSessionCount={weekSessionCount}
      streakDays={streak}
      streakHoursLeft={streakHoursLeft}
      lastSessionCaption={lastSessionCaption}
      friends={friendAvatars}
      currentUserId={userId}
      weightUnit={unit}
      challenges={challengeSummary}
      leaderboard={{
        globalRows: (globalResult.data ?? []).map(mapRow),
        friendsRows,
        friendCount: friendIds.length,
      }}
      insight={insight}
      avatarUrl={profile?.avatar_url}
    />
  )
}
