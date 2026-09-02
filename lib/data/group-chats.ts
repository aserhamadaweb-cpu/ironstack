'use server'

import { revalidatePath } from 'next/cache'
import type {
  GroupChat,
  GroupChatMember,
  GroupChatMemberRole,
  GroupMessage,
  GroupMessageWithSender,
  PublicProfile,
} from '@/lib/database.types'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import { fetchPublicProfilesByIds } from '@/lib/data/public-profiles'

type ProfileLite = Pick<
  PublicProfile,
  'id' | 'username' | 'display_name' | 'avatar_url'
>

export type GroupChatListItem = {
  chat: GroupChat
  myRole: GroupChatMemberRole | string
  memberCount: number
  lastMessage: Pick<GroupMessage, 'content' | 'created_at' | 'sender_id'> | null
  lastActivityAt: string
}

export type GroupChatDetail = {
  chat: GroupChat
  myRole: GroupChatMemberRole | string
  members: Array<GroupChatMember & { profile: ProfileLite | null }>
  messages: GroupMessageWithSender[]
}

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function loadProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, ProfileLite>> {
  const { data } = await fetchPublicProfilesByIds(supabase, ids)
  return new Map((data ?? []).map((p) => [p.id, p]))
}

export async function listGroupChatsForUser(
  userId: string,
): Promise<GroupChatListItem[]> {
  const supabase = await createClient()

  const { data: memberships, error: memError } = await supabase
    .from('group_chat_members')
    .select('group_chat_id, role')
    .eq('user_id', userId)

  if (memError || !memberships?.length) return []

  const groupIds = memberships.map((m) => m.group_chat_id as string)
  const roleByGroup = new Map(
    memberships.map((m) => [m.group_chat_id as string, m.role as string]),
  )

  const [{ data: chats }, { data: allMembers }, { data: recentMessages }] =
    await Promise.all([
      supabase
        .from('group_chats')
        .select('id, name, is_global, created_by, created_at, avatar_url')
        .in('id', groupIds),
      supabase
        .from('group_chat_members')
        .select('group_chat_id')
        .in('group_chat_id', groupIds),
      supabase
        .from('group_messages')
        .select('id, group_chat_id, sender_id, content, created_at')
        .in('group_chat_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(Math.max(groupIds.length * 3, 50)),
    ])

  const memberCount = new Map<string, number>()
  for (const row of allMembers ?? []) {
    const id = row.group_chat_id as string
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1)
  }

  const lastByGroup = new Map<
    string,
    Pick<GroupMessage, 'content' | 'created_at' | 'sender_id'>
  >()
  for (const row of (recentMessages ?? []) as GroupMessage[]) {
    if (!lastByGroup.has(row.group_chat_id)) {
      lastByGroup.set(row.group_chat_id, {
        content: row.content,
        created_at: row.created_at,
        sender_id: row.sender_id,
      })
    }
  }

  const items: GroupChatListItem[] = ((chats ?? []) as GroupChat[]).map(
    (chat) => {
      const last = lastByGroup.get(chat.id) ?? null
      return {
        chat,
        myRole: roleByGroup.get(chat.id) ?? 'member',
        memberCount: memberCount.get(chat.id) ?? 1,
        lastMessage: last,
        lastActivityAt: last?.created_at ?? chat.created_at,
      }
    },
  )

  items.sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime(),
  )
  return items
}

export async function getGroupChatForUser(
  groupId: string,
  userId: string,
): Promise<GroupChatDetail | null> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('group_chat_members')
    .select('id, group_chat_id, user_id, role, joined_at')
    .eq('group_chat_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return null

  const [{ data: chat }, { data: members }, { data: messages }] =
    await Promise.all([
      supabase
        .from('group_chats')
        .select('id, name, is_global, created_by, created_at, avatar_url')
        .eq('id', groupId)
        .maybeSingle(),
      supabase
        .from('group_chat_members')
        .select('id, group_chat_id, user_id, role, joined_at')
        .eq('group_chat_id', groupId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('group_messages')
        .select('id, group_chat_id, sender_id, content, created_at')
        .eq('group_chat_id', groupId)
        .order('created_at', { ascending: true })
        .limit(200),
    ])

  if (!chat) return null

  const memberRows = (members ?? []) as GroupChatMember[]
  const messageRows = (messages ?? []) as GroupMessage[]
  const profileIds = [
    ...memberRows.map((m) => m.user_id),
    ...messageRows.map((m) => m.sender_id),
  ]
  const profiles = await loadProfiles(supabase, profileIds)

  return {
    chat: chat as GroupChat,
    myRole: membership.role as string,
    members: memberRows.map((m) => ({
      ...m,
      profile: profiles.get(m.user_id) ?? null,
    })),
    messages: messageRows.map((m) => ({
      ...m,
      sender: profiles.get(m.sender_id) ?? null,
    })),
  }
}

export async function createGroupChatAction(input: {
  name: string
  memberIds: string[]
}): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')

  const name = input.name.trim()
  if (name.length < 2 || name.length > 60) {
    return fail('Group name must be 2–60 characters.')
  }

  const memberIds = [
    ...new Set(input.memberIds.filter((id) => id && id !== user.id)),
  ]
  if (memberIds.length === 0) {
    return fail('Add at least one friend to the group.')
  }

  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

  const friendIds = new Set(
    (friendships ?? []).map((row) =>
      row.user_id === user.id ? row.friend_id : row.user_id,
    ),
  )
  if (memberIds.some((id) => !friendIds.has(id))) {
    return fail('You can only add accepted friends to a group.')
  }

  const { data: chat, error: chatError } = await supabase
    .from('group_chats')
    .insert({
      name,
      is_global: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (chatError || !chat) {
    return fail(chatError?.message || 'Could not create the group.')
  }

  const memberRows = [
    {
      group_chat_id: chat.id,
      user_id: user.id,
      role: 'owner' as const,
    },
    ...memberIds.map((id) => ({
      group_chat_id: chat.id as string,
      user_id: id,
      role: 'member' as const,
    })),
  ]

  const { error: membersError } = await supabase
    .from('group_chat_members')
    .insert(memberRows)

  if (membersError) {
    await supabase.from('group_chats').delete().eq('id', chat.id)
    return fail(membersError.message)
  }

  revalidatePath('/dashboard/messages')
  return { ok: true, groupId: chat.id as string }
}

export async function sendGroupMessageAction(input: {
  groupId: string
  content: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')

  const content = input.content.trim()
  if (!content) return fail('Message cannot be empty.')
  if (content.length > 2000) return fail('Message is too long (max 2000).')

  const { data: membership } = await supabase
    .from('group_chat_members')
    .select('id')
    .eq('group_chat_id', input.groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return fail('You are not a member of this group.')

  const { error } = await supabase.from('group_messages').insert({
    group_chat_id: input.groupId,
    sender_id: user.id,
    content,
  })

  if (error) return fail(error.message)

  revalidatePath('/dashboard/messages')
  revalidatePath(`/dashboard/messages/groups/${input.groupId}`)
  return { ok: true }
}

export async function leaveGroupChatAction(
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')

  const { data: chat } = await supabase
    .from('group_chats')
    .select('is_global')
    .eq('id', groupId)
    .maybeSingle()

  if (chat?.is_global) {
    return fail('You cannot leave the community chat.')
  }

  const { error } = await supabase
    .from('group_chat_members')
    .delete()
    .eq('group_chat_id', groupId)
    .eq('user_id', user.id)

  if (error) return fail(error.message)

  revalidatePath('/dashboard/messages')
  revalidatePath(`/dashboard/messages/groups/${groupId}`)
  return { ok: true }
}

export async function removeGroupMemberAction(input: {
  groupId: string
  memberUserId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')
  if (input.memberUserId === user.id) {
    return fail('Use leave to remove yourself.')
  }

  const { data: me } = await supabase
    .from('group_chat_members')
    .select('role')
    .eq('group_chat_id', input.groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
    return fail('Only owners or admins can remove members.')
  }

  const { error } = await supabase
    .from('group_chat_members')
    .delete()
    .eq('group_chat_id', input.groupId)
    .eq('user_id', input.memberUserId)

  if (error) return fail(error.message)

  revalidatePath(`/dashboard/messages/groups/${input.groupId}`)
  return { ok: true }
}

export async function renameGroupChatAction(input: {
  groupId: string
  name: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')

  const name = input.name.trim()
  if (name.length < 2 || name.length > 60) {
    return fail('Group name must be 2–60 characters.')
  }

  const { data: me } = await supabase
    .from('group_chat_members')
    .select('role')
    .eq('group_chat_id', input.groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
    return fail('Only owners or admins can rename the group.')
  }

  const { data: chat } = await supabase
    .from('group_chats')
    .select('is_global')
    .eq('id', input.groupId)
    .maybeSingle()

  if (chat?.is_global) {
    return fail('The community chat cannot be renamed.')
  }

  const { error } = await supabase
    .from('group_chats')
    .update({ name })
    .eq('id', input.groupId)

  if (error) return fail(error.message)

  revalidatePath('/dashboard/messages')
  revalidatePath(`/dashboard/messages/groups/${input.groupId}`)
  return { ok: true }
}
