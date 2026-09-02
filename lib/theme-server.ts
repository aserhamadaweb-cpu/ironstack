import { createClient } from '@/lib/supabase/server'
import {
  isAppearanceMode,
  isThemePreference,
  type AppearanceMode,
  type ThemePreference,
} from '@/lib/theme'

/** Best-effort theme for SSR / provider — defaults to dark. */
export async function getServerThemePreference(): Promise<ThemePreference | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // Metadata appearance wins. System → no fixed profile theme.
    const appearance = user.user_metadata?.appearance
    if (appearance === 'system') return null
    if (isAppearanceMode(appearance) && appearance !== 'system') {
      return appearance
    }

    const { data } = await supabase
      .from('profiles')
      .select('theme_preference')
      .eq('id', user.id)
      .maybeSingle()

    const value = data?.theme_preference
    return isThemePreference(value) ? value : null
  } catch {
    return null
  }
}

/** Appearance mode from auth metadata (supports system). */
export async function getServerAppearanceMode(): Promise<AppearanceMode | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const appearance = user.user_metadata?.appearance
    if (isAppearanceMode(appearance)) return appearance
    return null
  } catch {
    return null
  }
}
