'use server'

import {
  markCelebrationsBannerShown,
} from '@/lib/ai/celebrations'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'

export async function markCelebrationsBannerShownAction(ids: string[]) {
  const guest = await rejectIfGuest()
  if (guest) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || ids.length === 0) return
  await markCelebrationsBannerShown(user.id, ids)
}
