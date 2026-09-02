import { createClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/log'

export type StreakStatus = {
  streakDays: number
  /** Hours until streak expires. null = never trained; 0 = already ended. */
  hoursLeft: number | null
}

/**
 * Current streak + hours remaining from the live Supabase RPCs
 * (`get_current_streak`, `get_streak_hours_left`).
 */
export async function fetchStreakStatus(userId: string): Promise<StreakStatus> {
  try {
    const supabase = await createClient()
    const [streakRes, hoursRes] = await Promise.all([
      supabase.rpc('get_current_streak', { p_user_id: userId }),
      supabase.rpc('get_streak_hours_left', { p_user_id: userId }),
    ])

    if (streakRes.error) {
      logServerError('[streak] get_current_streak', streakRes.error.message)
    }
    if (hoursRes.error) {
      logServerError('[streak] get_streak_hours_left', hoursRes.error.message)
    }

    const streakDays = Math.max(0, Math.floor(Number(streakRes.data) || 0))

    let hoursLeft: number | null = null
    if (!hoursRes.error && hoursRes.data !== null && hoursRes.data !== undefined) {
      const raw = Number(hoursRes.data)
      hoursLeft = Number.isFinite(raw) ? raw : null
    }

    return { streakDays, hoursLeft }
  } catch (err) {
    logServerError('[streak] fetchStreakStatus', err)
    return { streakDays: 0, hoursLeft: null }
  }
}
