'use server'

import { revalidatePath } from 'next/cache'
import {
  countUnreadNotifications,
  listNotifications,
  type NotificationListItem,
} from '@/lib/data/notifications'
import { createClient } from '@/lib/supabase/server'

export async function getNotificationsAction(): Promise<{
  notifications: NotificationListItem[]
  unreadCount: number
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { notifications: [], unreadCount: 0, error: 'Not signed in.' }
  }

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id),
    countUnreadNotifications(user.id),
  ])

  return { notifications, unreadCount }
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/home')
  return { ok: true }
}

export async function savePushSubscriptionAction(input: {
  endpoint: string
  p256dh: string
  authKey: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const endpoint = input.endpoint?.trim()
  const p256dh = input.p256dh?.trim()
  const authKey = input.authKey?.trim()
  if (!endpoint || !p256dh || !authKey) {
    return { ok: false, error: 'Invalid push subscription.' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth_key: authKey,
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    // Fallback if unique constraint name differs — delete then insert.
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
    const retry = await supabase.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth_key: authKey,
    })
    if (retry.error) return { ok: false, error: retry.error.message }
  }

  return { ok: true }
}

export async function removePushSubscriptionAction(
  endpoint?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  const trimmed = endpoint?.trim()
  if (trimmed) {
    query = query.eq('endpoint', trimmed)
  }

  const { error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
