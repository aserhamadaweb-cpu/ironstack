import { createClient } from '@/lib/supabase/server'
import type {
  DmMessage,
  DmThread,
  Follower,
  PublicProfile,
  SessionWithRelations,
} from '@/lib/database.types'
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/database.types'
import type { EarnedAchievement } from '@/lib/achievements'
import { listEarnedAchievementsForProfile } from '@/lib/data/achievements'
import { buildActivityHeatmap, type HeatmapCell } from '@/lib/heatmap'
import { isProfileUserIdParam, orderedDmPair } from '@/lib/profile-path'
import { fetchStreakStatus } from '@/lib/data/streak'
import { resolveLibraryExercise } from '@/lib/exercise-library.server'
import {
  fetchPublicProfileByUsernameOrId,
  fetchPublicProfilesByIds,
  friendlyPublicProfileError,
} from '@/lib/data/public-profiles'

/** Directional friendship: requester → recipient until accepted. */
export type FriendshipRelation = 'none' | 'outgoing' | 'incoming' | 'friends'

export type SocialListPerson = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  isFollowing: boolean
  isFriend: boolean
  friendshipStatus: FriendshipRelation
}

export type SharedSplitCard = {
  id: string
  name: string
  category: string | null
  description: string | null
  daysPerWeek: number
  exerciseCount: number
  alreadySaved: boolean
}

export type PublicProfileBundle = {
  profile: PublicProfile
  streakDays: number
  /** Hours until streak expires. null = never trained; 0 = ended. */
  streakHoursLeft: number | null
  followerCount: number
  followingCount: number
  friendCount: number
  isFriend: boolean
  friendshipStatus: FriendshipRelation
  isFollowing: boolean
  isSelf: boolean
  sessions: SessionWithRelations[]
  heatmap: HeatmapCell[]
  sharedSplits: SharedSplitCard[]
  records: Array<{
    id: string
    liftName: string
    muscleGroup: string
    weight: number
    reps: number
    loggedAt: string
  }>
  volumeBars: number[]
  achievements: EarnedAchievement[]
  analytics: {
    totalVolume: number
    totalSessions: number
    topMuscleGroup: string | null
  }
}

export async function getProfileByUsername(
  username: string,
): Promise<PublicProfile | null> {
  const supabase = await createClient()
  const { data, error } = await fetchPublicProfileByUsernameOrId(
    supabase,
    username,
  )
  if (error) return null
  return data
}

export async function getFollowCounts(userId: string) {
  const supabase = await createClient()
  const [{ count: followers }, { count: following }, { count: friends }] =
    await Promise.all([
      supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('followed_id', userId),
      supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    ])
  return {
    followerCount: followers ?? 0,
    followingCount: following ?? 0,
    friendCount: friends ?? 0,
  }
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('followers')
    .select('id')
    .eq('follower_id', followerId)
    .eq('followed_id', followingId)
    .maybeSingle()
  return Boolean(data)
}

export async function areFriends(
  userId: string,
  otherId: string,
): Promise<boolean> {
  const relation = await getFriendshipRelation(userId, otherId)
  return relation === 'friends'
}

/**
 * Friendship rows are directional for requests:
 * user_id = requester, friend_id = recipient, status pending|accepted|…
 */
export async function getFriendshipRelation(
  userId: string,
  otherId: string,
): Promise<FriendshipRelation> {
  if (userId === otherId) return 'none'
  const supabase = await createClient()
  const { data } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .in('status', ['pending', 'accepted'])
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${userId})`,
    )
    .maybeSingle()

  if (!data) return 'none'
  if (data.status === 'accepted') return 'friends'
  if (data.user_id === userId) return 'outgoing'
  return 'incoming'
}

export async function listIncomingFriendRequests(
  userId: string,
): Promise<
  Array<Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>>
> {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(40)

  const ids = (rows ?? []).map((r) => r.user_id)
  if (ids.length === 0) return []

  const { data: profiles } = await fetchPublicProfilesByIds(supabase, ids)

  const map = new Map((profiles ?? []).map((p) => [p.id, p]))
  return ids
    .map((id) => map.get(id))
    .filter((p): p is PublicProfile => Boolean(p))
    .map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    }))
}

const bundleInflight = new Map<
  string,
  Promise<{ data: PublicProfileBundle | null; error: string | null }>
>()

async function loadPublicProfileBundle(
  username: string,
  viewerId: string,
): Promise<{ data: PublicProfileBundle | null; error: string | null }> {
  const started = Date.now()
  const supabase = await createClient()
  const raw = username.trim()
  if (!raw) return { data: null, error: 'Profile not found.' }

  const profileQueryResult = await fetchPublicProfileByUsernameOrId(
    supabase,
    raw,
  )
  if (profileQueryResult.error) {
    return {
      data: null,
      error: friendlyPublicProfileError(
        'Could not load this profile.',
        profileQueryResult.error,
      ),
    }
  }
  let profile = profileQueryResult.data
  if (
    !profile &&
    isProfileUserIdParam(raw) &&
    raw === viewerId
  ) {
    const { data: ownProfile, error: ownError } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', viewerId)
      .maybeSingle()
    if (ownError) {
      return {
        data: null,
        error: friendlyPublicProfileError(
          'Could not load this profile.',
          ownError.message,
        ),
      }
    }
    profile = (ownProfile as PublicProfile | null) ?? null
  }
  if (!profile) return { data: null, error: 'Profile not found.' }

  const heatmapSince = new Date()
  heatmapSince.setDate(heatmapSince.getDate() - 100)
  const isSelf = viewerId === profile.id

  // Light sessions for heatmap/streak/volume (no nested joins).
  // Separate tiny query for the 3 recent cards that need split names.
  const [
    heatmapSessionsResult,
    recentSessionsResult,
    followersCount,
    followingCount,
    friendsCount,
    followingRow,
    friendshipRow,
    sharedSplitsResult,
    prsResult,
    streakStatus,
    achievements,
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select(
        'started_at, finished_at, total_volume, total_sets_completed',
      )
      .eq('user_id', profile.id)
      .eq('status', 'completed')
      .gte('started_at', heatmapSince.toISOString())
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(120),
    supabase
      .from('sessions')
      .select(
        'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at, splits(id, name), split_days(id, name)',
      )
      .eq('user_id', profile.id)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('followed_id', profile.id),
    supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`),
    isSelf
      ? Promise.resolve({ data: null as { id: string } | null })
      : supabase
          .from('followers')
          .select('id')
          .eq('follower_id', viewerId)
          .eq('followed_id', profile.id)
          .maybeSingle(),
    isSelf
      ? Promise.resolve({
          data: null as {
            user_id: string
            friend_id: string
            status: string
          } | null,
        })
      : supabase
          .from('friendships')
          .select('user_id, friend_id, status')
          .in('status', ['pending', 'accepted'])
          .or(
            `and(user_id.eq.${viewerId},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${viewerId})`,
          )
          .maybeSingle(),
    supabase
      .from('splits')
      .select('id, name, description, days_per_week, category, is_shared')
      .eq('user_id', profile.id)
      .eq('is_shared', true)
      .eq('is_system', false)
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('personal_records')
      .select(
        'id, user_id, lift_type_id, weight, reps, is_current_pr, logged_at, lift_types(id, name, slug, muscle_group, image_url)',
      )
      .eq('user_id', profile.id)
      .eq('is_current_pr', true)
      .order('weight', { ascending: false }),
    fetchStreakStatus(profile.id),
    listEarnedAchievementsForProfile(profile.id),
  ])

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[fetch-trace] getPublicProfileBundle parallel-batch @${profile.username ?? profile.id}`,
    )
  }

  if (heatmapSessionsResult.error) {
    return { data: null, error: heatmapSessionsResult.error.message }
  }
  if (recentSessionsResult.error) {
    return { data: null, error: recentSessionsResult.error.message }
  }
  if (prsResult.error) {
    return { data: null, error: prsResult.error.message }
  }

  const heatmapRows = heatmapSessionsResult.data ?? []
  const sessions = (recentSessionsResult.data ??
    []) as unknown as SessionWithRelations[]
  const streakDays = streakStatus.streakDays
  const streakHoursLeft = streakStatus.hoursLeft
  const heatmap = buildActivityHeatmap(
    heatmapRows.map((s) => ({
      started_at: s.started_at,
      finished_at: s.finished_at,
      total_volume: s.total_volume,
      total_sets_completed: s.total_sets_completed,
    })),
    13,
  )

  const volumeSeries = [...sessions]
    .reverse()
    .map((s) => Number(s.total_volume) || 0)
  const maxVol = Math.max(...volumeSeries, 1)
  const volumeBars =
    volumeSeries.length > 0
      ? volumeSeries.map((v) => Math.max(6, Math.round((v / maxVol) * 100)))
      : []

  const totalVolume = heatmapRows.reduce(
    (sum, s) => sum + (Number(s.total_volume) || 0),
    0,
  )
  // Approximate all-time from the window — avoids an extra exact-count round-trip.
  const totalSessions = heatmapRows.length

  const records = (prsResult.data ?? []).map((row) => {
    const lift = Array.isArray(row.lift_types)
      ? row.lift_types[0]
      : row.lift_types
    const name = (lift as { name?: string } | null)?.name ?? 'Lift'
    const catalog = resolveLibraryExercise(name)
    return {
      id: row.id,
      liftName: name,
      muscleGroup:
        (lift as { muscle_group?: string } | null)?.muscle_group ??
        catalog?.muscles[0] ??
        'Other',
      image:
        (lift as { image_url?: string | null } | null)?.image_url ||
        catalog?.image ||
        null,
      weight: Number(row.weight) || 0,
      reps: Number(row.reps) || 0,
      loggedAt: row.logged_at,
    }
  })

  // Top muscle from PRs — avoids scanning thousands of lift_logs.
  const muscleCounts = new Map<string, number>()
  for (const r of records) {
    muscleCounts.set(r.muscleGroup, (muscleCounts.get(r.muscleGroup) ?? 0) + 1)
  }
  let topMuscleGroup: string | null = null
  let topCount = 0
  for (const [group, count] of muscleCounts) {
    if (count > topCount) {
      topCount = count
      topMuscleGroup = group
    }
  }

  const sharedRows = sharedSplitsResult.error
    ? []
    : (sharedSplitsResult.data ?? [])
  const sharedIds = sharedRows.map((s) => s.id as string)

  let savedSourceIds = new Set<string>()
  if (sharedIds.length > 0 && !isSelf) {
    const { data: savedCopies } = await supabase
      .from('splits')
      .select('source_split_id')
      .eq('user_id', viewerId)
      .in('source_split_id', sharedIds)
    savedSourceIds = new Set(
      (savedCopies ?? [])
        .map((r) => r.source_split_id as string | null)
        .filter((v): v is string => Boolean(v)),
    )
  }

  const sharedSplits: SharedSplitCard[] = sharedRows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    daysPerWeek: Number(row.days_per_week) || 0,
    exerciseCount: 0,
    alreadySaved: savedSourceIds.has(row.id as string),
  }))

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[profile_bundle] @${profile.username ?? profile.id} ${Date.now() - started}ms`,
    )
  }

  let friendshipStatus: FriendshipRelation = 'none'
  const friendship = friendshipRow.data
  if (friendship?.status === 'accepted') {
    friendshipStatus = 'friends'
  } else if (friendship?.status === 'pending') {
    friendshipStatus =
      friendship.user_id === viewerId ? 'outgoing' : 'incoming'
  }

  return {
    data: {
      profile,
      streakDays,
      streakHoursLeft,
      followerCount: followersCount.count ?? 0,
      followingCount: followingCount.count ?? 0,
      friendCount: friendsCount.count ?? 0,
      isFriend: friendshipStatus === 'friends',
      friendshipStatus,
      isFollowing: Boolean(followingRow.data),
      isSelf,
      sessions,
      heatmap,
      sharedSplits,
      records,
      volumeBars,
      achievements,
      analytics: {
        totalVolume,
        totalSessions,
        topMuscleGroup,
      },
    },
    error: null,
  }
}

/**
 * Dedupes concurrent RSC/prefetch storms for the same profile+viewer.
 * React.cache alone only helps within a single request; Link prefeches are
 * separate HTTP requests that were each re-running the full Supabase batch.
 */
export function getPublicProfileBundle(
  username: string,
  viewerId: string,
): Promise<{ data: PublicProfileBundle | null; error: string | null }> {
  const key = `${username.trim().toLowerCase()}::${viewerId}`
  const existing = bundleInflight.get(key)
  if (existing) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[fetch-trace] getPublicProfileBundle REUSE in-flight ${key}`)
    }
    return existing
  }

  const promise = loadPublicProfileBundle(username, viewerId).finally(() => {
    // Keep briefly so late-arriving twin requests still share the result.
    setTimeout(() => {
      if (bundleInflight.get(key) === promise) {
        bundleInflight.delete(key)
      }
    }, 2500)
  })
  bundleInflight.set(key, promise)
  return promise
}

async function relationFlags(
  viewerId: string,
  personIds: string[],
): Promise<
  Map<
    string,
    { isFollowing: boolean; isFriend: boolean; friendshipStatus: FriendshipRelation }
  >
> {
  const map = new Map<
    string,
    { isFollowing: boolean; isFriend: boolean; friendshipStatus: FriendshipRelation }
  >()
  for (const id of personIds) {
    map.set(id, {
      isFollowing: false,
      isFriend: false,
      friendshipStatus: 'none',
    })
  }
  if (personIds.length === 0) return map

  const supabase = await createClient()
  const idList = personIds.join(',')
  const [{ data: follows }, { data: friendships }] = await Promise.all([
    supabase
      .from('followers')
      .select('followed_id')
      .eq('follower_id', viewerId)
      .in('followed_id', personIds),
    supabase
      .from('friendships')
      .select('user_id, friend_id, status')
      .in('status', ['pending', 'accepted'])
      .or(
        `and(user_id.eq.${viewerId},friend_id.in.(${idList})),and(friend_id.eq.${viewerId},user_id.in.(${idList}))`,
      ),
  ])

  for (const row of follows ?? []) {
    const cur = map.get(row.followed_id)
    if (cur) cur.isFollowing = true
  }
  const idSet = new Set(personIds)
  for (const row of friendships ?? []) {
    const other = row.user_id === viewerId ? row.friend_id : row.user_id
    if (!idSet.has(other)) continue
    const cur = map.get(other)
    if (!cur) continue
    if (row.status === 'accepted') {
      cur.isFriend = true
      cur.friendshipStatus = 'friends'
    } else if (row.status === 'pending') {
      cur.friendshipStatus =
        row.user_id === viewerId ? 'outgoing' : 'incoming'
    }
  }
  return map
}

export async function listProfileSocial(
  profileUserId: string,
  viewerId: string,
  kind: 'followers' | 'following' | 'friends',
): Promise<SocialListPerson[]> {
  const supabase = await createClient()
  let ids: string[] = []

  if (kind === 'followers') {
    const { data } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('followed_id', profileUserId)
      .order('created_at', { ascending: false })
      .limit(200)
    ids = (data ?? []).map((r) => r.follower_id)
  } else if (kind === 'following') {
    const { data } = await supabase
      .from('followers')
      .select('followed_id')
      .eq('follower_id', profileUserId)
      .order('created_at', { ascending: false })
      .limit(200)
    ids = (data ?? []).map((r) => r.followed_id)
  } else {
    const { data } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${profileUserId},friend_id.eq.${profileUserId}`)
      .limit(200)
    ids = (data ?? []).map((r) =>
      r.user_id === profileUserId ? r.friend_id : r.user_id,
    )
  }

  ids = [...new Set(ids)]
  if (ids.length === 0) return []

  const [{ data: profiles }, flags] = await Promise.all([
    fetchPublicProfilesByIds(supabase, ids),
    relationFlags(viewerId, ids),
  ])

  const order = new Map(ids.map((id, i) => [id, i]))

  return ((profiles ?? []) as Pick<
    PublicProfile,
    'id' | 'username' | 'display_name' | 'avatar_url'
  >[])
    .map((p) => {
      const rel = flags.get(p.id) ?? {
        isFollowing: false,
        isFriend: false,
        friendshipStatus: 'none' as FriendshipRelation,
      }
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        isFollowing: rel.isFollowing,
        isFriend: rel.isFriend,
        friendshipStatus: rel.friendshipStatus,
      }
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

export type DmThreadListItem = {
  /** Null when this is an accepted friend with no dm_thread yet. */
  thread: DmThread | null
  other: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  lastMessage: Pick<DmMessage, 'content' | 'created_at' | 'sender_id'> | null
  unreadHint: boolean
}

export async function listDmThreads(userId: string): Promise<DmThreadListItem[]> {
  const supabase = await createClient()

  const [{ data: threads, error: threadsError }, { data: friendships }] =
    await Promise.all([
      supabase
        .from('dm_threads')
        .select(
          'id, user_a_id, user_b_id, initiated_by, status, created_at, updated_at',
        )
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('updated_at', { ascending: false }),
      supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    ])

  if (threadsError) return []

  const threadRows = (threads ?? []) as DmThread[]
  const friendIds = [
    ...new Set(
      (friendships ?? []).map((row) =>
        row.user_id === userId ? row.friend_id : row.user_id,
      ),
    ),
  ]

  const threadOtherIds = threadRows.map((t) =>
    t.user_a_id === userId ? t.user_b_id : t.user_a_id,
  )
  const profileIds = [...new Set([...threadOtherIds, ...friendIds])]
  if (profileIds.length === 0) return []

  const { data: profiles } = await fetchPublicProfilesByIds(supabase, profileIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const items: DmThreadListItem[] = []
  for (const thread of threadRows) {
    const otherId =
      thread.user_a_id === userId ? thread.user_b_id : thread.user_a_id
    const other = profileMap.get(otherId)
    if (!other) continue

    const { data: last } = await supabase
      .from('dm_messages')
      .select('content, created_at, sender_id')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    items.push({
      thread,
      other: {
        id: other.id,
        username: other.username,
        display_name: other.display_name,
        avatar_url: other.avatar_url,
      },
      lastMessage: last
        ? {
            content: last.content,
            created_at: last.created_at,
            sender_id: last.sender_id,
          }
        : null,
      unreadHint: Boolean(last && last.sender_id !== userId),
    })
  }

  const partnersWithThread = new Set(threadOtherIds)
  const friendsWithoutThread = friendIds
    .filter((id) => !partnersWithThread.has(id))
    .map((id) => profileMap.get(id))
    .filter((p): p is PublicProfile => Boolean(p))
    .sort((a, b) => {
      const an = (a.display_name || a.username || '').toLowerCase()
      const bn = (b.display_name || b.username || '').toLowerCase()
      return an.localeCompare(bn)
    })
    .map((other) => ({
      thread: null,
      other: {
        id: other.id,
        username: other.username,
        display_name: other.display_name,
        avatar_url: other.avatar_url,
      },
      lastMessage: null,
      unreadHint: false,
    }))

  return [...items, ...friendsWithoutThread]
}

export async function getThreadForUser(
  threadId: string,
  userId: string,
): Promise<{
  thread: DmThread
  other: Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  messages: DmMessage[]
  isFriend: boolean
} | null> {
  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('dm_threads')
    .select('id, user_a_id, user_b_id, initiated_by, status, created_at, updated_at')
    .eq('id', threadId)
    .maybeSingle()

  if (!thread) return null
  if (thread.user_a_id !== userId && thread.user_b_id !== userId) return null

  const otherId =
    thread.user_a_id === userId ? thread.user_b_id : thread.user_a_id
  const [{ data: others }, { data: messages }, friend] = await Promise.all([
    fetchPublicProfilesByIds(supabase, [otherId]),
    supabase
      .from('dm_messages')
      .select('id, thread_id, sender_id, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(200),
    areFriends(userId, otherId),
  ])

  const other = others[0]
  if (!other) return null

  return {
    thread: thread as DmThread,
    other: {
      id: other.id,
      username: other.username,
      display_name: other.display_name,
      avatar_url: other.avatar_url,
    },
    messages: (messages ?? []) as DmMessage[],
    isFriend: friend,
  }
}

export async function findOrCreateDmThread(
  userId: string,
  otherUserId: string,
): Promise<{ threadId: string; error?: string }> {
  if (userId === otherUserId) {
    return { threadId: '', error: 'Cannot message yourself.' }
  }

  // Cookie-backed SSR client — same session JWT RLS will see as auth.uid().
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { threadId: '', error: 'Not signed in.' }
  }
  if (user.id !== userId) {
    return { threadId: '', error: 'Not signed in.' }
  }

  // Lexicographic order satisfies check (user_a_id < user_b_id).
  const pair = orderedDmPair(user.id, otherUserId)

  const { data: existing } = await supabase
    .from('dm_threads')
    .select('id')
    .eq('user_a_id', pair.user_a_id)
    .eq('user_b_id', pair.user_b_id)
    .maybeSingle()

  if (existing) return { threadId: existing.id }

  const row = {
    user_a_id: pair.user_a_id,
    user_b_id: pair.user_b_id,
    initiated_by: user.id,
    status: 'pending' as const,
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('[dm_threads] insert', {
      ...row,
      auth_uid: user.id,
    })
  }

  const { data: created, error } = await supabase
    .from('dm_threads')
    .insert(row)
    .select('id')
    .single()

  if (!error && created) {
    return { threadId: created.id }
  }

  // Race: another request created the unique pair — reuse it.
  const isUnique =
    error?.code === '23505' ||
    /duplicate|unique/i.test(error?.message ?? '')
  if (isUnique) {
    const { data: again } = await supabase
      .from('dm_threads')
      .select('id')
      .eq('user_a_id', pair.user_a_id)
      .eq('user_b_id', pair.user_b_id)
      .maybeSingle()
    if (again) return { threadId: again.id }
  }

  console.error('[dm_threads] insert failed', {
    ...row,
    auth_uid: user.id,
    error: error?.message,
    code: error?.code,
  })

  return { threadId: '', error: error?.message ?? 'Could not start chat.' }
}

/** Exported for actions — avoid unused import lint on Follower. */
export type { Follower }
