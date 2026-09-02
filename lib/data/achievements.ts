'use server'

import { revalidatePath } from 'next/cache'
import type {
  Achievement,
  UserAchievement,
  UserAchievementJoined,
} from '@/lib/database.types'
import {
  collapseEarnedForProfile,
  type EarnedAchievement,
} from '@/lib/achievements'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function listAchievementsCatalog(): Promise<Achievement[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('achievements')
    .select('id, slug, name, description, category, icon, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[achievements] catalog', error.message)
    return []
  }
  return (data ?? []) as Achievement[]
}

export async function listUserAchievements(
  userId: string,
): Promise<UserAchievementJoined[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_achievements')
    .select(
      'user_id, achievement_id, earned_at, display_order, achievements(id, slug, name, description, category, icon, sort_order)',
    )
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error) {
    console.error('[achievements] user', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    user_id: row.user_id as string,
    achievement_id: row.achievement_id as string,
    earned_at: row.earned_at as string,
    display_order:
      typeof row.display_order === 'number' ? row.display_order : null,
    achievements: oneRelation(
      row.achievements as Achievement | Achievement[] | null,
    ),
  }))
}

export async function listEarnedAchievementsForProfile(
  userId: string,
): Promise<EarnedAchievement[]> {
  const rows = await listUserAchievements(userId)
  const earned: EarnedAchievement[] = []
  for (const row of rows) {
    if (!row.achievements) continue
    earned.push({
      ...row.achievements,
      earned_at: row.earned_at,
      display_order: row.display_order,
    })
  }
  return collapseEarnedForProfile(earned)
}

export async function listRawUserAchievementRows(
  userId: string,
): Promise<UserAchievement[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_achievements')
    .select('user_id, achievement_id, earned_at, display_order')
    .eq('user_id', userId)

  if (error) {
    console.error('[achievements] raw', error.message)
    return []
  }
  return (data ?? []).map((row) => ({
    user_id: row.user_id as string,
    achievement_id: row.achievement_id as string,
    earned_at: row.earned_at as string,
    display_order:
      typeof row.display_order === 'number' ? row.display_order : null,
  }))
}

/** Persist sequential display_order for the viewer's earned badges. */
export async function reorderAchievementsAction(
  orderedAchievementIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const ids = orderedAchievementIds.filter(Boolean)
  if (ids.length === 0) return { ok: false, error: 'Nothing to reorder.' }

  const results = await Promise.all(
    ids.map((achievementId, index) =>
      supabase
        .from('user_achievements')
        .update({ display_order: index })
        .eq('user_id', user.id)
        .eq('achievement_id', achievementId),
    ),
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) {
    return { ok: false, error: failed.error.message }
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/achievements')
  revalidatePath(`/profile/${user.id}`)
  revalidatePath('/dashboard/home')
  return { ok: true }
}

/** Fire-and-forget style RPC for the Top 10 streak leaderboard badge. */
export async function checkTop10AchievementAction(
  userId: string,
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return

  const { error } = await supabase.rpc('check_top10_achievement', {
    p_user_id: userId,
  })
  if (error) {
    console.error('[achievements] top10 rpc', error.message)
  }
}
