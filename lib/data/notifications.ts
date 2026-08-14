import { createClient } from '@/lib/supabase/server'
import type { AppNotification, Profile } from '@/lib/database.types'

export type NotificationListItem = AppNotification & {
  related: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null
}

export async function listNotifications(
  userId: string,
  limit = 30,
): Promise<NotificationListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, user_id, type, title, body, link, related_user_id, is_read, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  const relatedIds = [
    ...new Set(
      data
        .map((n) => n.related_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  let relatedMap = new Map<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  >()

  if (relatedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', relatedIds)
    relatedMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  }

  return (data as AppNotification[]).map((n) => ({
    ...n,
    related: n.related_user_id
      ? (relatedMap.get(n.related_user_id) ?? null)
      : null,
  }))
}

export async function countUnreadNotifications(
  userId: string,
): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) return 0
  return count ?? 0
}
