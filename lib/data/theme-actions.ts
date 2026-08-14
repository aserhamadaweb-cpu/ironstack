'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ThemePreference } from '@/lib/theme'

export async function updateThemePreferenceAction(
  theme: ThemePreference,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (theme !== 'dark' && theme !== 'light') {
    return { ok: false, error: 'Theme must be dark or light.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // Guests persist via localStorage only — not an error.
    return { ok: true }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      theme_preference: theme,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}
