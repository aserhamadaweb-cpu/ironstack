'use server'

import { revalidatePath } from 'next/cache'
import {
  findOrCreateDmThread,
  getProfileByUsername,
  isFollowing,
  listIncomingFriendRequests,
  listProfileSocial,
  type FriendshipRelation,
  type SocialListPerson,
} from '@/lib/data/social'
import { buildSessionSummary } from '@/lib/data/session-summary'
import type { SessionSummaryData } from '@/lib/data/session-summary'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import {
  fetchPublicProfilesByIds,
  PUBLIC_PROFILES_VIEW,
} from '@/lib/data/public-profiles'
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/database.types'

async function guestSocialBlocked() {
  const error = await rejectIfGuest()
  return error ? { ok: false as const, error } : null
}

async function revalidateProfilePaths(userId: string, otherId: string) {
  const supabase = await createClient()
  const { data: profiles } = await fetchPublicProfilesByIds(supabase, [
    userId,
    otherId,
  ])
  for (const profile of profiles ?? []) {
    if (profile.username) revalidatePath(`/profile/${profile.username}`)
    revalidatePath(`/profile/${profile.id}`)
  }
  revalidatePath('/dashboard/home')
}

export async function followUserAction(followedId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  if (user.id === followedId) {
    return { ok: false, error: 'Cannot follow yourself.' }
  }

  const { error } = await supabase.from('followers').insert({
    follower_id: user.id,
    followed_id: followedId,
  })

  if (error) {
    if (error.message.toLowerCase().includes('duplicate')) {
      return { ok: true }
    }
    return { ok: false, error: error.message }
  }

  const { data: followed } = await fetchPublicProfilesByIds(supabase, [
    followedId,
  ])
  const profile = followed[0]
  if (profile?.username) revalidatePath(`/profile/${profile.username}`)
  revalidatePath(`/profile/${followedId}`)
  revalidatePath('/dashboard/home')
  return { ok: true }
}

export async function unfollowUserAction(followedId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_id', user.id)
    .eq('followed_id', followedId)

  if (error) return { ok: false, error: error.message }

  const { data: followed } = await fetchPublicProfilesByIds(supabase, [
    followedId,
  ])
  const profile = followed[0]
  if (profile?.username) revalidatePath(`/profile/${profile.username}`)
  revalidatePath(`/profile/${followedId}`)
  revalidatePath('/dashboard/home')
  return { ok: true }
}

/** Followers-only status — never reads friendships. */
export async function getFollowStatusAction(profileUserId: string): Promise<{
  isFollowing: boolean
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isFollowing: false, error: 'Not signed in.' }
  if (user.id === profileUserId) return { isFollowing: false }

  const { data, error } = await supabase
    .from('followers')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followed_id', profileUserId)
    .maybeSingle()

  if (error) return { isFollowing: false, error: error.message }
  return { isFollowing: Boolean(data) }
}

/** Friendships-only status — never reads followers. */
export async function getFriendshipStatusAction(profileUserId: string): Promise<{
  status: FriendshipRelation
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'none', error: 'Not signed in.' }
  if (user.id === profileUserId) return { status: 'none' }

  const { data, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .in('status', ['pending', 'accepted'])
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${profileUserId}),and(user_id.eq.${profileUserId},friend_id.eq.${user.id})`,
    )
    .maybeSingle()

  if (error) return { status: 'none', error: error.message }
  if (!data) return { status: 'none' }
  if (data.status === 'accepted') return { status: 'friends' }
  if (data.user_id === user.id) return { status: 'outgoing' }
  return { status: 'incoming' }
}

export async function sendFriendRequestAction(otherUserId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  if (user.id === otherUserId) {
    return { ok: false, error: 'Cannot add yourself.' }
  }

  // If they already sent us a request, accept it instead.
  const { data: incoming } = await supabase
    .from('friendships')
    .select('id, status')
    .eq('user_id', otherUserId)
    .eq('friend_id', user.id)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()

  if (incoming?.status === 'accepted') {
    return { ok: true, status: 'friends' as FriendshipRelation }
  }
  if (incoming?.status === 'pending') {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', incoming.id)
    if (error) return { ok: false, error: error.message }
    await revalidateProfilePaths(user.id, otherUserId)
    return { ok: true, status: 'friends' as FriendshipRelation }
  }

  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('friend_id', otherUserId)
    .maybeSingle()

  if (existing?.status === 'accepted') {
    return { ok: true, status: 'friends' as FriendshipRelation }
  }
  if (existing?.status === 'pending') {
    return { ok: true, status: 'outgoing' as FriendshipRelation }
  }

  if (existing) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'pending' })
      .eq('id', existing.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from('friendships').insert({
      user_id: user.id,
      friend_id: otherUserId,
      status: 'pending',
    })
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return { ok: true, status: 'outgoing' as FriendshipRelation }
      }
      return { ok: false, error: error.message }
    }
  }

  await revalidateProfilePaths(user.id, otherUserId)
  return { ok: true, status: 'outgoing' as FriendshipRelation }
}

export async function acceptFriendRequestAction(otherUserId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: row, error: findError } = await supabase
    .from('friendships')
    .select('id')
    .eq('user_id', otherUserId)
    .eq('friend_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (findError) return { ok: false, error: findError.message }
  if (!row) return { ok: false, error: 'No pending request found.' }

  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', row.id)

  if (error) return { ok: false, error: error.message }
  await revalidateProfilePaths(user.id, otherUserId)
  return { ok: true, status: 'friends' as FriendshipRelation }
}

export async function declineFriendRequestAction(otherUserId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', otherUserId)
    .eq('friend_id', user.id)
    .eq('status', 'pending')

  if (error) return { ok: false, error: error.message }
  await revalidateProfilePaths(user.id, otherUserId)
  return { ok: true, status: 'none' as FriendshipRelation }
}

export async function cancelFriendRequestAction(otherUserId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', user.id)
    .eq('friend_id', otherUserId)
    .eq('status', 'pending')

  if (error) return { ok: false, error: error.message }
  await revalidateProfilePaths(user.id, otherUserId)
  return { ok: true, status: 'none' as FriendshipRelation }
}

export async function unfriendAction(otherUserId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('status', 'accepted')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${user.id})`,
    )

  if (error) return { ok: false, error: error.message }
  await revalidateProfilePaths(user.id, otherUserId)
  return { ok: true, status: 'none' as FriendshipRelation }
}

export async function listFriendRequestsAction(): Promise<{
  people: Array<{
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  }>
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { people: [], error: 'Not signed in.' }

  try {
    const people = await listIncomingFriendRequests(user.id)
    return { people }
  } catch (err) {
    return {
      people: [],
      error: err instanceof Error ? err.message : 'Could not load requests.',
    }
  }
}

export async function startDmWithUserAction(otherUserId: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false as const, error: 'Not signed in.', threadId: '' }
  }

  const result = await findOrCreateDmThread(user.id, otherUserId)
  if (result.error) {
    return { ok: false as const, error: result.error, threadId: '' }
  }
  revalidatePath('/dashboard/messages')
  return { ok: true as const, threadId: result.threadId, error: null }
}

export async function startDmByUsernameAction(username: string) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const profile = await getProfileByUsername(username)
  if (!profile) {
    return { ok: false as const, error: 'User not found.', threadId: '' }
  }
  return startDmWithUserAction(profile.id)
}

export async function sendDmMessageAction(input: {
  threadId: string
  content: string
}) {
  const blocked = await guestSocialBlocked()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const content = input.content.trim()
  if (!content) return { ok: false, error: 'Message cannot be empty.' }
  if (content.length > 2000) return { ok: false, error: 'Message is too long.' }

  const { data: thread } = await supabase
    .from('dm_threads')
    .select('id, user_a_id, user_b_id, status')
    .eq('id', input.threadId)
    .maybeSingle()

  if (!thread) return { ok: false, error: 'Thread not found.' }
  if (thread.user_a_id !== user.id && thread.user_b_id !== user.id) {
    return { ok: false, error: 'Not allowed.' }
  }

  const { error } = await supabase.from('dm_messages').insert({
    thread_id: input.threadId,
    sender_id: user.id,
    content,
  })

  if (error) {
    // DB trigger may block a second message on pending threads.
    return {
      ok: false,
      error:
        error.message.includes('pending') ||
        error.message.toLowerCase().includes('one message') ||
        error.code === 'P0001'
          ? 'Waiting for a reply before you can send another message.'
          : error.message,
    }
  }

  await supabase
    .from('dm_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.threadId)

  revalidatePath('/dashboard/messages')
  revalidatePath(`/dashboard/messages/${input.threadId}`)
  return { ok: true }
}

export async function ensureFollowingBeforeMessage(
  followingId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  return isFollowing(user.id, followingId)
}

export async function getSocialListAction(
  profileUserId: string,
  kind: 'followers' | 'following' | 'friends',
): Promise<{ people: SocialListPerson[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { people: [], error: 'Not signed in.' }

  try {
    const people = await listProfileSocial(profileUserId, user.id, kind)
    return { people }
  } catch (err) {
    return {
      people: [],
      error: err instanceof Error ? err.message : 'Could not load list.',
    }
  }
}

export async function getSessionSummaryAction(
  sessionId: string,
): Promise<{ data: SessionSummaryData | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not signed in.' }

  const result = await buildSessionSummary(sessionId)
  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'Session not found.' }
  }
  return { data: result.data }
}

export type DiscoverPerson = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  isFollowing: boolean
  isFriend: boolean
  friendshipStatus: FriendshipRelation
}

export async function searchPeopleAction(
  query: string,
): Promise<{ people: DiscoverPerson[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { people: [], error: 'Not signed in.' }

  const q = query.trim().replace(/[%_,]/g, '').slice(0, 40)
  if (q.length < 1) return { people: [] }

  const { data: profiles, error } = await supabase
    .from(PUBLIC_PROFILES_VIEW)
    .select(PUBLIC_PROFILE_COLUMNS)
    .neq('id', user.id)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order('username', { ascending: true })
    .limit(24)

  if (error) return { people: [], error: error.message }
  if (!profiles?.length) return { people: [] }

  const ids = profiles.map((p) => p.id)
  const idList = ids.join(',')
  const [{ data: follows }, { data: friendships }] = await Promise.all([
    supabase
      .from('followers')
      .select('followed_id')
      .eq('follower_id', user.id)
      .in('followed_id', ids),
    supabase
      .from('friendships')
      .select('user_id, friend_id, status')
      .in('status', ['pending', 'accepted'])
      .or(
        `and(user_id.eq.${user.id},friend_id.in.(${idList})),and(friend_id.eq.${user.id},user_id.in.(${idList}))`,
      ),
  ])

  const followingSet = new Set((follows ?? []).map((f) => f.followed_id))
  const statusMap = new Map<string, FriendshipRelation>()
  for (const row of friendships ?? []) {
    const other = row.user_id === user.id ? row.friend_id : row.user_id
    if (!ids.includes(other)) continue
    if (row.status === 'accepted') statusMap.set(other, 'friends')
    else if (row.status === 'pending') {
      statusMap.set(
        other,
        row.user_id === user.id ? 'outgoing' : 'incoming',
      )
    }
  }

  return {
    people: profiles.map((p) => {
      const friendshipStatus = statusMap.get(p.id) ?? 'none'
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        isFollowing: followingSet.has(p.id),
        isFriend: friendshipStatus === 'friends',
        friendshipStatus,
      }
    }),
  }
}

/** Messages from other people newer than `sinceIso`. Empty since looks back 7 days. */
export async function countUnseenIncomingMessagesAction(
  sinceIso: string | null,
): Promise<{ count: number }> {
  const blocked = await rejectIfGuest()
  if (blocked) return { count: 0 }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const parsed = sinceIso ? Date.parse(sinceIso) : Number.NaN
  const since = Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: threads }, { data: memberships }] = await Promise.all([
    supabase
      .from('dm_threads')
      .select('id')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
    supabase
      .from('group_chat_members')
      .select('group_chat_id')
      .eq('user_id', user.id),
  ])

  const threadIds = (threads ?? []).map((row) => row.id)
  const groupIds = (memberships ?? []).map((row) => row.group_chat_id)

  const [dmResult, groupResult] = await Promise.all([
    threadIds.length > 0
      ? supabase
          .from('dm_messages')
          .select('id', { count: 'exact', head: true })
          .in('thread_id', threadIds)
          .neq('sender_id', user.id)
          .gt('created_at', since)
      : Promise.resolve({ count: 0, error: null }),
    groupIds.length > 0
      ? supabase
          .from('group_messages')
          .select('id', { count: 'exact', head: true })
          .in('group_chat_id', groupIds)
          .neq('sender_id', user.id)
          .gt('created_at', since)
      : Promise.resolve({ count: 0, error: null }),
  ])

  const dmCount = dmResult.error ? 0 : (dmResult.count ?? 0)
  const groupCount = groupResult.error ? 0 : (groupResult.count ?? 0)
  return { count: dmCount + groupCount }
}
