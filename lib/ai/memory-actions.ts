'use server'

import { revalidatePath } from 'next/cache'
import { deactivateMemory, getActiveMemories } from '@/lib/ai/memory'
import { createClient } from '@/lib/supabase/server'

export async function listActiveMemoriesAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not signed in.' }

  const data = await getActiveMemories(user.id)
  return {
    data: data.map((m) => ({
      id: m.id,
      fact: m.fact,
      category: m.category,
      updatedAt: m.updated_at,
    })),
    error: null as string | null,
  }
}

export async function deactivateMemoryAction(memoryId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const result = await deactivateMemory(user.id, memoryId)
  if (result.ok) {
    revalidatePath('/dashboard/ai-coach')
    revalidatePath('/dashboard/profile')
  }
  return result
}
