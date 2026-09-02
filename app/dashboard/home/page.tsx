import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { HomeDashboard } from '@/components/home-dashboard'
import {
  getAcceptedFriends,
  getCompletedSessions,
  getLeaderboard,
  getProfile,
} from '@/lib/data/queries'
import { refreshSuggestions } from '@/lib/ai/suggestions'
import { ltrEmbed } from '@/lib/bidi'
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

  let profileResult: Awaited<ReturnType<typeof getProfile>> = {
    data: null,
    error: null,
  }
  let sessionsResult: Awaited<ReturnType<typeof getCompletedSessions>> = {
    data: [],
    error: null,
  }
  let friendsResult: Awaited<ReturnType<typeof getAcceptedFriends>> = {
    data: [],
    error: null,
  }
  let globalResult: Awaited<ReturnType<typeof getLeaderboard>> = {
    data: [],
    error: null,
  }
  let streakStatus = { streakDays: 0, hoursLeft: null as number | null }

  try {
    const profileProbe = await getProfile(userId)
    const unreachable = Boolean(
      profileProbe.error &&
        /reach the server|fetch failed|failed to fetch/i.test(profileProbe.error),
    )

    if (unreachable) {
      throw new Error('offline')
    }

    const fetched = await Promise.all([
      Promise.resolve(profileProbe),
      getCompletedSessions(userId, 21),
      getAcceptedFriends(userId),
      getLeaderboard({ limit: 20 }),
      fetchStreakStatus(userId),
    ])
    profileResult = fetched[0]
    sessionsResult = fetched[1]
    friendsResult = fetched[2]
    globalResult = fetched[3]
    streakStatus = fetched[4]
  } catch {
    /* Offline / unreachable Supabase — render Home with cached client data. */
  }

  // Home is the post-login landing page, so this is where proactive coach
  // suggestions get generated. Deferred so it never blocks the render, and
  // internally rate-limited, so most loads are a no-op.
  after(async () => {
    try {
      await refreshSuggestions(userId)
    } catch {
      /* A missing nudge is not worth surfacing. */
    }
  })

  const friends = friendsResult.data ?? []
  const friendIds = friends.map(({ profile }) => profile.id)

  let friendsBoardResult: Awaited<ReturnType<typeof getLeaderboard>> = {
    data: [],
    error: null,
  }
  if (friendIds.length > 0) {
    try {
      friendsBoardResult = await getLeaderboard({
        userIds: [...friendIds, userId],
        limit: 20,
      })
    } catch {
      friendsBoardResult = { data: [], error: null }
    }
  }

  const liveDegraded = Boolean(
    profileResult.error ||
      sessionsResult.error ||
      friendsResult.error ||
      globalResult.error ||
      friendsBoardResult.error ||
      !profileResult.data,
  )

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
      isGuest={profile?.is_guest === true}
      weekActivity={weekActivity}
      weekSessionCount={weekSessionCount}
      streakDays={streak}
      streakHoursLeft={streakHoursLeft}
      lastSessionCaption={lastSessionCaption}
      friends={friendAvatars}
      currentUserId={userId}
      weightUnit={unit}
      leaderboard={{
        globalRows: (globalResult.data ?? []).map(mapRow),
        friendsRows,
        friendCount: friendIds.length,
      }}
      avatarUrl={profile?.avatar_url}
      liveDegraded={liveDegraded}
    />
  )
}
