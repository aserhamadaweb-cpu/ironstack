import { createClient } from '@/lib/supabase/server'

export type AiConversation = {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export type AiMessageRow = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  created_at: string
  tool_name?: string | null
  tool_call_id?: string | null
}

export type ChatMessageDto = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  usedTools: boolean
}

/** Short title from the user's opening message. */
export function titleFromFirstMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New chat'
  if (cleaned.length <= 48) return cleaned
  return `${cleaned.slice(0, 45).trimEnd()}…`
}

export function mapMessagesWithUsedTools(
  messages: AiMessageRow[],
): ChatMessageDto[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      let usedTools = false
      if (m.role === 'assistant') {
        const fullIdx = messages.findIndex((row) => row.id === m.id)
        for (let j = fullIdx - 1; j >= 0; j -= 1) {
          if (messages[j].role === 'tool') {
            usedTools = true
            break
          }
          if (
            messages[j].role === 'user' ||
            messages[j].role === 'assistant'
          ) {
            break
          }
        }
      }
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.created_at,
        usedTools,
      }
    })
}

export async function listConversations(
  userId: string,
  limit = 40,
): Promise<AiConversation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, user_id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as AiConversation[]
}

export async function createConversation(
  userId: string,
  title: string | null = 'New chat',
): Promise<AiConversation> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: userId, title })
    .select('id, user_id, title, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not start a conversation.')
  }
  return data as AiConversation
}

export async function getConversationForUser(
  userId: string,
  conversationId: string,
): Promise<{ conversation: AiConversation; messages: AiMessageRow[] } | null> {
  const supabase = await createClient()
  const { data: conversation } = await supabase
    .from('ai_conversations')
    .select('id, user_id, title, created_at, updated_at')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!conversation) return null

  const { data: messages, error } = await supabase
    .from('ai_messages')
    .select('id, conversation_id, role, content, created_at')
    .eq('conversation_id', conversation.id)
    .in('role', ['user', 'assistant', 'tool'])
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw new Error(error.message)

  return {
    conversation: conversation as AiConversation,
    messages: (messages ?? []) as AiMessageRow[],
  }
}

/**
 * Load an empty conversation to open, or create one.
 * Reuses any existing conversation with zero messages; otherwise creates fresh
 * when the most recent chat already has messages (or none exist).
 */
export async function getOrCreateLatestConversation(
  userId: string,
): Promise<{ conversation: AiConversation; messages: AiMessageRow[] }> {
  const list = await listConversations(userId, 40)
  const supabase = await createClient()

  for (const conv of list) {
    const { count, error } = await supabase
      .from('ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)

    if (error) throw new Error(error.message)
    if ((count ?? 0) === 0) {
      return { conversation: conv, messages: [] }
    }
  }

  const conversation = await createConversation(userId, 'New chat')
  return { conversation, messages: [] }
}

export async function setConversationTitle(
  userId: string,
  conversationId: string,
  title: string,
) {
  const supabase = await createClient()
  await supabase
    .from('ai_conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
}

export async function insertAiMessage(input: {
  conversationId: string
  userId: string
  role: AiMessageRow['role']
  content: string
  toolName?: string | null
  toolCallId?: string | null
}) {
  const supabase = await createClient()

  const { data: owned } = await supabase
    .from('ai_conversations')
    .select('id, title')
    .eq('id', input.conversationId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (!owned) {
    throw new Error('Conversation not found.')
  }

  const richPayload = {
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    tool_name: input.toolName ?? null,
    tool_call_id: input.toolCallId ?? null,
  }

  let { data, error } = await supabase
    .from('ai_messages')
    .insert(richPayload)
    .select('id, conversation_id, role, content, created_at')
    .single()

  if (
    error &&
    /tool_name|tool_call_id|schema cache|column/i.test(error.message)
  ) {
    const fallback = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: input.conversationId,
        role: input.role,
        content:
          input.role === 'tool' && input.toolName
            ? `[${input.toolName}] ${input.content}`
            : input.content,
      })
      .select('id, conversation_id, role, content, created_at')
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not save message.')
  }

  const now = new Date().toISOString()
  const updates: { updated_at: string; title?: string } = { updated_at: now }

  // Auto-title from the first user message when still generic.
  if (
    input.role === 'user' &&
    (!owned.title ||
      owned.title === 'New chat' ||
      owned.title === 'IronStack Coach')
  ) {
    updates.title = titleFromFirstMessage(input.content)
  }

  await supabase
    .from('ai_conversations')
    .update(updates)
    .eq('id', input.conversationId)
    .eq('user_id', input.userId)

  return data as AiMessageRow
}
