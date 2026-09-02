/**
 * Read-only tools that support the write actions.
 *
 * Without these the model proposes no-ops ("switch to kg" when already kg) or
 * invents ids it cannot know. Reads need no confirmation — they only surface
 * data the athlete can already see in the UI.
 */

import { getActiveMemories } from '@/lib/ai/memory'
import { listFriendRequestsAction } from '@/lib/data/social-actions'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/database.types'
import { createClient } from '@/lib/supabase/server'

export async function getBodyWeightHistory(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, weight_kg, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(20)

  if (error) return { error: 'no_data', message: error.message }
  if (!data?.length) {
    return { entries: [], message: 'No body weight entries logged yet.' }
  }
  return {
    entries: data.map((row) => ({
      log_id: row.id,
      weight_kg: Number(row.weight_kg),
      logged_at: row.logged_at,
    })),
  }
}

export async function getSavedNotes(userId: string) {
  const memories = await getActiveMemories(userId)
  if (memories.length === 0) {
    return { notes: [], message: 'No durable notes saved yet.' }
  }
  return {
    notes: memories.map((memory) => ({
      memory_id: memory.id,
      fact: memory.fact,
      category: memory.category,
    })),
  }
}

export async function getAccountSettings(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'preferred_unit, language, theme_preference, notification_preferences, privacy_follow, privacy_friend_request, privacy_message, height_cm, gender, birth_date, display_name, bio, avatar_url',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) return { error: 'no_data', message: error.message }
  if (!data) return { error: 'no_data', message: 'Profile not found.' }

  const notifications: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...((data.notification_preferences ?? {}) as Partial<NotificationPreferences>),
  }

  return {
    preferred_unit: data.preferred_unit,
    language: data.language,
    theme: data.theme_preference ?? 'system',
    notifications,
    privacy: {
      follow: data.privacy_follow,
      friend_request: data.privacy_friend_request,
      message: data.privacy_message,
    },
    body_stats: {
      height_cm: data.height_cm,
      gender: data.gender,
      birth_date: data.birth_date,
    },
    profile: {
      display_name: data.display_name,
      bio: data.bio,
      has_avatar: Boolean(data.avatar_url),
    },
    note: 'Email, password, and username are not changeable from chat.',
  }
}

export async function getPendingSocial(userId: string) {
  const supabase = await createClient()

  const [requests, challenges] = await Promise.all([
    listFriendRequestsAction(),
    supabase
      .from('challenges')
      .select(
        'id, creator_id, opponent_id, status, target_weight, target_reps, lift_types(name)',
      )
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const incoming = requests.people.map((person) => ({
    username: person.username,
    display_name: person.display_name,
  }))

  const challengeRows = (challenges.data ?? []).map((row) => {
    const lift = Array.isArray(row.lift_types) ? row.lift_types[0] : row.lift_types
    return {
      challenge_id: row.id,
      role: row.creator_id === userId ? 'creator' : 'opponent',
      status: row.status,
      lift: (lift as { name?: string } | null)?.name ?? null,
      target_weight: Number(row.target_weight),
      target_reps: Number(row.target_reps),
    }
  })

  return {
    incoming_friend_requests: incoming,
    challenges: challengeRows,
  }
}
