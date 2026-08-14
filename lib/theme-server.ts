import { createClient } from '@/lib/supabase/server'
import { isThemePreference, type ThemePreference } from '@/lib/theme'

/** Best-effort theme for SSR / provider — defaults to dark. */
export async function getServerThemePreference(): Promise<ThemePreference | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

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
