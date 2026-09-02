import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  readOnboardingState,
} from '@/lib/onboarding-storage'
import {
  emptyOnboardingData,
  type OnboardingData,
} from '@/lib/onboarding-types'

export function onboardingDataFromUser(
  user: User,
  profile?: Parameters<typeof readOnboardingState>[1],
): OnboardingData {
  return readOnboardingState(user, profile ?? undefined).data
}

/** Read-only onboarding state for Server Components (no cookie writes). */
export async function loadOnboardingPageState(): Promise<{
  incomplete: boolean
  completed: boolean
  data: OnboardingData
  email: string | null
  avatarUrl: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      incomplete: false,
      completed: true,
      data: emptyOnboardingData(),
      email: null,
      avatarUrl: null,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, username, preferred_unit, height_cm, current_weight_kg, gender, language, theme_preference, avatar_url',
    )
    .eq('id', user.id)
    .maybeSingle()

  const state = readOnboardingState(user, profile ?? undefined)
  return {
    incomplete: state.incomplete,
    completed: state.completed && !state.incomplete,
    data: state.data,
    email: user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  }
}
