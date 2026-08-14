import { createClient } from '@/lib/supabase/server'

export type AiUserMemory = {
  id: string
  user_id: string
  fact: string
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const MEMORY_CATEGORIES = [
  'injury',
  'equipment',
  'preference',
  'goal',
  'other',
] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

function normalizeCategory(raw: unknown): MemoryCategory {
  const value = String(raw ?? 'other')
    .trim()
    .toLowerCase()
  if ((MEMORY_CATEGORIES as readonly string[]).includes(value)) {
    return value as MemoryCategory
  }
  return 'other'
}

export async function getActiveMemories(
  userId: string,
): Promise<AiUserMemory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_user_memory')
    .select('id, user_id, fact, category, is_active, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(40)

  if (error) {
    console.error('[ai_user_memory]', error.message)
    return []
  }
  return (data ?? []) as AiUserMemory[]
}

/**
 * Insert a durable note. userId MUST come from auth — never from the model.
 */
export async function saveUserNote(
  userId: string,
  fact: string,
  category?: unknown,
): Promise<{ ok: true; id: string; fact: string; category: string } | { ok: false; message: string }> {
  const cleaned = fact.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    return { ok: false, message: 'fact is required.' }
  }
  if (cleaned.length > 500) {
    return { ok: false, message: 'fact is too long (max 500 chars).' }
  }

  const cat = normalizeCategory(category)
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('ai_user_memory')
    .insert({
      user_id: userId,
      fact: cleaned,
      category: cat,
      is_active: true,
      updated_at: now,
    })
    .select('id, fact, category')
    .single()

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Could not save note.',
    }
  }

  return {
    ok: true,
    id: data.id,
    fact: data.fact,
    category: data.category,
  }
}

export async function deactivateMemory(
  userId: string,
  memoryId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_user_memory')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export function formatMemoriesForPrompt(memories: AiUserMemory[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m) => {
    const cat = m.category ? `[${m.category}] ` : ''
    return `- ${cat}${m.fact}`
  })
  return `Known durable facts about this athlete (from prior chats — honor these; do not invent extras):\n${lines.join('\n')}`
}
