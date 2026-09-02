import { createClient } from '@/lib/supabase/server'
import {
  isAgentPreview,
  isSessionProposal,
  isSplitProposal,
  type CoachUiAction,
} from '@/lib/ai/action-types'
import { undoableActionNames } from '@/lib/ai/agent/undoable'

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
  action?: CoachUiAction
}

/** Short title from the user's opening message. */
export function titleFromFirstMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New chat'
  if (cleaned.length <= 48) return cleaned
  return `${cleaned.slice(0, 45).trimEnd()}…`
}

function parseToolPayload(row: AiMessageRow): { name: string; result: unknown } | null {
  if (row.role !== 'tool') return null
  let raw = row.content
  let name = row.tool_name ?? ''
  const prefixed = raw.match(/^\[([^\]]+)\]\s([\s\S]*)$/)
  if (prefixed) {
    if (!name) name = prefixed[1]
    raw = prefixed[2]
  }
  try {
    return { name, result: JSON.parse(raw) as unknown }
  } catch {
    return name ? { name, result: raw } : null
  }
}

export function extractCoachActionFromTrace(
  trace: Array<{ name: string; result: unknown }>,
): CoachUiAction | undefined {
  for (let i = trace.length - 1; i >= 0; i -= 1) {
    const action = actionFromPayload(trace[i].name, trace[i].result)
    if (action) return action
  }
  return undefined
}

function actionFromPayload(name: string, result: unknown): CoachUiAction | undefined {
  if (!result || typeof result !== 'object') return undefined

  const queued = result as {
    status?: string
    pendingActionId?: unknown
    actionName?: unknown
    preview?: unknown
  }
  if (
    queued.status === 'pending_confirmation' &&
    typeof queued.pendingActionId === 'string' &&
    queued.pendingActionId.length > 0 &&
    isAgentPreview(queued.preview)
  ) {
    return {
      type: 'agent_action',
      pendingActionId: queued.pendingActionId,
      actionName:
        typeof queued.actionName === 'string' ? queued.actionName : name,
      preview: queued.preview,
      status: 'pending',
    }
  }

  const proposal = (result as { proposal?: unknown }).proposal
  if (isSplitProposal(proposal)) {
    if (
      name === 'propose_split' ||
      name === 'propose_update_split' ||
      !name ||
      (result as { status?: string }).status === 'pending_confirmation'
    ) {
      return { type: 'split_preview', proposal, status: 'pending' }
    }
  }
  if (isSessionProposal(proposal)) {
    if (
      name === 'propose_session_action' ||
      !name ||
      (result as { status?: string }).status === 'pending_confirmation'
    ) {
      return { type: 'session_preview', proposal, status: 'pending' }
    }
  }
  return undefined
}

export function mapMessagesWithUsedTools(
  messages: AiMessageRow[],
): ChatMessageDto[] {
  const applied = new Map<string, { splitId: string; href?: string }>()
  const discarded = new Set<string>()
  const cancelled = new Set<string>()
  for (const row of messages) {
    const parsed = parseToolPayload(row)
    if (!parsed || typeof parsed.result !== 'object' || !parsed.result) continue
    const result = parsed.result as {
      proposalId?: string
      splitId?: string
      href?: string
      applied?: boolean
      discarded?: boolean
      cancelled?: boolean
    }
    if (
      result.applied &&
      result.proposalId &&
      result.splitId &&
      (parsed.name === 'confirm_create_split' || parsed.name === 'confirm_update_split')
    ) {
      applied.set(result.proposalId, { splitId: result.splitId, href: result.href })
    }
    if (result.discarded && result.proposalId) {
      discarded.add(result.proposalId)
    }
    if (result.cancelled && result.proposalId) {
      cancelled.add(result.proposalId)
    }
  }

  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      let usedTools = false
      let action: CoachUiAction | undefined
      if (m.role === 'assistant') {
        const fullIdx = messages.findIndex((row) => row.id === m.id)
        for (let j = fullIdx - 1; j >= 0; j -= 1) {
          if (messages[j].role === 'tool') {
            usedTools = true
            const parsed = parseToolPayload(messages[j])
            if (parsed && !action) {
              action = actionFromPayload(parsed.name, parsed.result)
            }
            continue
          }
          if (
            messages[j].role === 'user' ||
            messages[j].role === 'assistant'
          ) {
            break
          }
        }
        if (action?.type === 'split_preview') {
          const saved = applied.get(action.proposal.id)
          if (saved) {
            action = {
              ...action,
              status: 'saved',
              splitHref: saved.href ?? `/dashboard/splits/${saved.splitId}`,
            }
          } else if (cancelled.has(action.proposal.id)) {
            action = { ...action, status: 'cancelled' }
          }
        }
        if (action?.type === 'session_preview' && discarded.has(action.proposal.id)) {
          action = { ...action, status: 'done' }
        }
      }
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.created_at,
        usedTools,
        action,
      }
    })
}

/**
 * Resolve the real state of queued agent actions.
 *
 * The chat transcript only records that a change was proposed. Whether it was
 * confirmed, cancelled, expired, or later undone lives in
 * `ai_pending_actions` / `ai_action_audit`, so reloading a conversation has to
 * look it up rather than trusting the stored tool payload.
 */
export async function hydrateAgentActionStatuses(
  userId: string,
  messages: ChatMessageDto[],
): Promise<ChatMessageDto[]> {
  const ids = [
    ...new Set(
      messages
        .map((m) => (m.action?.type === 'agent_action' ? m.action.pendingActionId : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (ids.length === 0) return messages

  const supabase = await createClient()
  const [pendingRes, auditRes] = await Promise.all([
    supabase
      .from('ai_pending_actions')
      .select('id, status, expires_at')
      .eq('user_id', userId)
      .in('id', ids),
    supabase
      .from('ai_action_audit')
      .select('id, pending_action_id, status, summary')
      .eq('user_id', userId)
      .in('pending_action_id', ids),
  ])

  const pendingById = new Map(
    (pendingRes.data ?? []).map((row) => [row.id as string, row]),
  )
  const auditByPending = new Map<
    string,
    { id: string; status: string; summary: string }
  >()
  for (const row of auditRes.data ?? []) {
    if (!row.pending_action_id) continue
    auditByPending.set(row.pending_action_id as string, {
      id: row.id as string,
      status: row.status as string,
      summary: (row.summary as string) ?? '',
    })
  }

  // An undo is a separate append-only entry pointing back at the original, so
  // "already undone" has to be looked up by those audit ids.
  const auditIds = [...auditByPending.values()].map((entry) => entry.id)
  const undoneAuditIds = new Set<string>()
  if (auditIds.length > 0) {
    const { data: undos } = await supabase
      .from('ai_action_audit')
      .select('undo_of')
      .eq('user_id', userId)
      .in('undo_of', auditIds)
    for (const row of undos ?? []) {
      if (row.undo_of) undoneAuditIds.add(row.undo_of as string)
    }
  }

  const undoable = undoableActionNames()
  const now = Date.now()

  return messages.map((message) => {
    if (message.action?.type !== 'agent_action') return message
    const card = message.action
    const pending = pendingById.get(card.pendingActionId)
    const audit = auditByPending.get(card.pendingActionId)

    if (audit?.status === 'executed') {
      return {
        ...message,
        action: {
          ...card,
          status: 'applied',
          auditId: audit.id,
          summary: audit.summary,
          undoable: undoable.has(card.actionName),
          undone: undoneAuditIds.has(audit.id),
        },
      }
    }
    if (audit?.status === 'failed') {
      return { ...message, action: { ...card, status: 'failed' } }
    }
    if (!pending) {
      return { ...message, action: { ...card, status: 'expired' } }
    }
    if (pending.status === 'cancelled') {
      return { ...message, action: { ...card, status: 'cancelled' } }
    }
    if (
      pending.status === 'expired' ||
      (pending.status === 'pending' &&
        new Date(pending.expires_at as string).getTime() < now)
    ) {
      return { ...message, action: { ...card, status: 'expired' } }
    }
    return message
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
    .select('id, conversation_id, role, content, created_at, tool_name')
    .eq('conversation_id', conversation.id)
    .in('role', ['user', 'assistant', 'tool'])
    .order('created_at', { ascending: true })
    .limit(200)

  if (error && /tool_name|schema cache|column/i.test(error.message)) {
    const fallback = await supabase
      .from('ai_messages')
      .select('id, conversation_id, role, content, created_at')
      .eq('conversation_id', conversation.id)
      .in('role', ['user', 'assistant', 'tool'])
      .order('created_at', { ascending: true })
      .limit(200)
    if (fallback.error) throw new Error(fallback.error.message)
    return {
      conversation: conversation as AiConversation,
      messages: (fallback.data ?? []) as AiMessageRow[],
    }
  }

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
