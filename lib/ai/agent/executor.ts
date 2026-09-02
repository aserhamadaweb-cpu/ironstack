/**
 * The one path through which the AI coach changes anything.
 *
 * Flow:
 *   1. propose  — the model calls a tool; we validate, snapshot, and persist a
 *                 single-use pending row. Nothing is written to the athlete's
 *                 data. The model is told to stop and point at the card.
 *   2. confirm  — the athlete taps Confirm. We atomically claim the pending row
 *                 (so a double tap or replayed request cannot apply twice),
 *                 re-validate against current state, execute, and append audit.
 *   3. undo     — reverses a previously executed action and appends a second
 *                 audit row rather than editing the first.
 *
 * Every underlying write goes through the same server action the UI calls, on
 * the athlete's own Supabase session. There is no service-role path here.
 */

import { revalidatePath } from 'next/cache'
import { resolveAgentAction } from '@/lib/ai/agent/registry'
import type {
  AgentExecuted,
  AgentFailure,
  AgentPreview,
  JsonValue,
} from '@/lib/ai/agent/types'
import { createClient } from '@/lib/supabase/server'

const PENDING_TTL_MINUTES = 60

export type ProposeResult =
  | {
      status: 'pending_confirmation'
      pendingActionId: string
      actionName: string
      preview: AgentPreview
      /** Instruction for the model, not shown to the athlete. */
      message: string
    }
  | Record<string, unknown>

export type ConfirmResult =
  | {
      ok: true
      auditId: string
      actionName: string
      summary: string
      href?: string
      undoable: boolean
      /** Client must apply this immediately — ThemeProvider reads localStorage. */
      appearance?: 'dark' | 'light' | 'system'
    }
  | { ok: false; error: string; code?: string }

export type UndoResult =
  | { ok: true; auditId: string; summary: string; appearance?: 'dark' | 'light' | 'system' }
  | { ok: false; error: string }

type PendingRow = {
  id: string
  user_id: string
  conversation_id: string | null
  action_name: string
  args: Record<string, unknown>
  preview: AgentPreview
  request_text: string | null
  status: string
  expires_at: string
}

type AuditRow = {
  id: string
  user_id: string
  conversation_id: string | null
  action_name: string
  args: Record<string, unknown>
  request_text: string | null
  before_state: JsonValue
  after_state: JsonValue
  status: string
}

/**
 * Guests are anonymous sessions with no durable account. They can browse but
 * must not have an agent making changes on their behalf.
 */
async function assertNotGuest(userId: string): Promise<AgentFailure | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) {
    return { ok: false, error: 'You must be signed in.' }
  }
  if (user.is_anonymous) {
    return {
      ok: false,
      error: 'Create a free account to let the coach make changes for you.',
      code: 'guest_blocked',
    }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_guest')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.is_guest === true) {
    return {
      ok: false,
      error: 'Create a free account to let the coach make changes for you.',
      code: 'guest_blocked',
    }
  }
  return null
}

/**
 * Phase 1. Validates and queues, never applies.
 * The return value is handed to Gemini verbatim as the tool result.
 */
export async function proposeAgentAction(input: {
  userId: string
  conversationId: string | null
  actionName: string
  args: Record<string, unknown>
  requestText: string
}): Promise<ProposeResult> {
  const lookup = resolveAgentAction(input.actionName)
  if (!lookup.ok) return lookup.refusal

  const guest = await assertNotGuest(input.userId)
  if (guest) {
    return { error: guest.code ?? 'not_permitted', message: guest.error }
  }

  // Model-supplied identity is never trusted.
  const args = { ...input.args }
  delete args.user_id
  delete args.userId

  const prepared = await lookup.action.prepare({ userId: input.userId }, args)
  if (!prepared.ok) {
    return {
      error: prepared.code ?? 'needs_clarification',
      message: prepared.error,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_pending_actions')
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      action_name: lookup.action.name,
      // Store the model-shaped args prepare already accepted — confirm
      // re-runs prepare with this payload. Storing prepared.args breaks
      // re-prepare (camelCase keys like weightKg vs weight).
      args: args as unknown as JsonValue,
      preview: prepared.preview as unknown as JsonValue,
      request_text: input.requestText.slice(0, 4000),
      expires_at: new Date(
        Date.now() + PENDING_TTL_MINUTES * 60_000,
      ).toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[agent propose]', error?.message)
    return {
      error: 'storage_failed',
      message: 'Could not queue that change. Ask the athlete to try again.',
    }
  }

  return {
    status: 'pending_confirmation',
    pendingActionId: data.id,
    actionName: lookup.action.name,
    preview: prepared.preview,
    message:
      'Queued for confirmation only — nothing has changed yet. Stop calling ' +
      'tools and tell the athlete in one short sentence what is waiting on the ' +
      'confirmation card below. Never claim it is done.',
  }
}

/** Phase 2. Applies the queued change after explicit consent. */
export async function confirmAgentAction(
  userId: string,
  pendingActionId: string,
): Promise<ConfirmResult> {
  const guest = await assertNotGuest(userId)
  if (guest) return { ok: false, error: guest.error, code: guest.code }

  const supabase = await createClient()
  const now = new Date().toISOString()

  // Atomic single-use claim: only a row that is still pending and unexpired
  // flips to confirmed, so a double-tap or replay cannot execute twice.
  const { data: claimed } = await supabase
    .from('ai_pending_actions')
    .update({ status: 'confirmed', resolved_at: now })
    .eq('id', pendingActionId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .select(
      'id, user_id, conversation_id, action_name, args, preview, request_text, status, expires_at',
    )
    .maybeSingle()

  if (!claimed) {
    const { data: existing } = await supabase
      .from('ai_pending_actions')
      .select('status, expires_at')
      .eq('id', pendingActionId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existing) {
      return { ok: false, error: 'That request is no longer available.' }
    }
    if (existing.status === 'confirmed') {
      return { ok: false, error: 'That change was already applied.', code: 'already_applied' }
    }
    if (existing.status === 'cancelled') {
      return { ok: false, error: 'That request was cancelled.' }
    }
    return {
      ok: false,
      error: 'That request expired. Ask me again and I will rebuild it.',
      code: 'expired',
    }
  }

  const pending = claimed as PendingRow
  const lookup = resolveAgentAction(pending.action_name)
  if (!lookup.ok) {
    // An action was removed from the allow-list after being queued.
    return {
      ok: false,
      error: 'That action is no longer available.',
      code: 'unsupported_action',
    }
  }

  const ctx = { userId }

  // Re-validate against live state — the world may have moved since the
  // proposal, and this also produces a fresh before-snapshot for undo.
  const prepared = await lookup.action.prepare(ctx, pending.args)
  if (!prepared.ok) {
    // Claim already flipped pending→confirmed. Put it back so the athlete can
    // retry (or so a bad stored payload does not permanently burn the card).
    await supabase
      .from('ai_pending_actions')
      .update({ status: 'pending', resolved_at: null })
      .eq('id', pending.id)
      .eq('user_id', userId)
      .eq('status', 'confirmed')

    await writeAudit({
      userId,
      pending,
      status: 'failed',
      summary: pending.preview?.title ?? pending.action_name,
      before: null,
      after: null,
      error: prepared.error,
      // No prepared args available — keep the raw payload for diagnosis.
      args: pending.args as unknown as JsonValue,
    })
    return { ok: false, error: prepared.error, code: prepared.code }
  }

  let outcome: AgentExecuted | AgentFailure
  try {
    outcome = await lookup.action.execute(ctx, prepared)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected failure.'
    console.error('[agent execute]', pending.action_name, err)
    outcome = { ok: false, error: message }
  }

  if (!outcome.ok) {
    await writeAudit({
      userId,
      pending,
      status: 'failed',
      summary: pending.preview?.title ?? pending.action_name,
      before: prepared.before,
      after: null,
      error: outcome.error,
      args: prepared.args as unknown as JsonValue,
    })
    return { ok: false, error: outcome.error, code: outcome.code }
  }

  const auditId = await writeAudit({
    userId,
    pending,
    status: 'executed',
    summary: outcome.summary,
    before: prepared.before,
    after: outcome.after,
    // Undo reads target ids / prepared fields from the audit args column.
    args: prepared.args as unknown as JsonValue,
  })

  revalidateAfterAgentWrite()

  const appearance =
    pending.action_name === 'set_theme'
      ? ((prepared.args as { theme?: string }).theme === 'light' ||
        (prepared.args as { theme?: string }).theme === 'dark'
          ? ((prepared.args as { theme: 'dark' | 'light' }).theme)
          : undefined)
      : undefined

  return {
    ok: true,
    auditId,
    actionName: pending.action_name,
    summary: outcome.summary,
    href: outcome.href,
    undoable: Boolean(lookup.action.undo) && pending.preview?.undoable !== false,
    appearance,
  }
}

export async function cancelAgentAction(
  userId: string,
  pendingActionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_pending_actions')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('id', pendingActionId)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Phase 3. Reverses an executed action by appending a compensating record. */
export async function undoAgentAction(
  userId: string,
  auditId: string,
): Promise<UndoResult> {
  const guest = await assertNotGuest(userId)
  if (guest) return { ok: false, error: guest.error }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('ai_action_audit')
    .select(
      'id, user_id, conversation_id, action_name, args, request_text, before_state, after_state, status',
    )
    .eq('id', auditId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'That action was not found.' }
  const entry = row as AuditRow
  if (entry.status !== 'executed') {
    return { ok: false, error: 'That action was not applied, so there is nothing to undo.' }
  }

  // An undo row already pointing here means it was reversed before.
  const { count: undoCount } = await supabase
    .from('ai_action_audit')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('undo_of', auditId)

  if ((undoCount ?? 0) > 0) {
    return { ok: false, error: 'That change was already undone.' }
  }

  const lookup = resolveAgentAction(entry.action_name)
  if (!lookup.ok || !lookup.action.undo) {
    return { ok: false, error: 'That kind of change cannot be undone automatically.' }
  }

  let outcome: AgentExecuted | AgentFailure
  try {
    outcome = await lookup.action.undo(
      { userId },
      {
        args: entry.args ?? {},
        before: entry.before_state,
        after: entry.after_state,
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected failure.'
    console.error('[agent undo]', entry.action_name, err)
    outcome = { ok: false, error: message }
  }

  if (!outcome.ok) return { ok: false, error: outcome.error }

  const { data: inserted } = await supabase
    .from('ai_action_audit')
    .insert({
      user_id: userId,
      conversation_id: entry.conversation_id,
      action_name: `undo:${entry.action_name}`,
      summary: outcome.summary,
      args: entry.args as unknown as JsonValue,
      request_text: entry.request_text,
      before_state: entry.after_state,
      after_state: outcome.after,
      status: 'executed',
      undo_of: auditId,
    })
    .select('id')
    .single()

  revalidateAfterAgentWrite()

  const appearance =
    entry.action_name === 'set_theme'
      ? (() => {
          const theme = (outcome.after as { theme?: string | null } | null)?.theme
          if (theme === 'dark' || theme === 'light') return theme
          if (theme === null) return 'system' as const
          return undefined
        })()
      : undefined

  return {
    ok: true,
    auditId: inserted?.id ?? auditId,
    summary: outcome.summary,
    appearance,
  }
}

async function writeAudit(input: {
  userId: string
  pending: PendingRow
  status: 'executed' | 'failed'
  summary: string
  before: JsonValue
  after: JsonValue
  error?: string
  /** Prepared args for undo; defaults to the pending (raw) payload. */
  args?: JsonValue
}): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_action_audit')
    .insert({
      user_id: input.userId,
      conversation_id: input.pending.conversation_id,
      pending_action_id: input.pending.id,
      action_name: input.pending.action_name,
      summary: input.summary,
      args: (input.args ?? (input.pending.args as unknown as JsonValue)),
      request_text: input.pending.request_text,
      before_state: input.before,
      after_state: input.after,
      status: input.status,
      error: input.error ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // Never fail a completed action because logging failed, but make it loud.
    console.error('[agent audit] write failed', error.message)
    return ''
  }
  return data?.id ?? ''
}

/**
 * Agent writes can touch any surface, and the underlying server actions only
 * revalidate their own pages. Refresh the shared dashboard shells too.
 */
function revalidateAfterAgentWrite() {
  for (const path of [
    '/dashboard/home',
    '/dashboard/workout',
    '/dashboard/splits',
    '/dashboard/profile',
    '/dashboard/settings',
    '/dashboard/community',
    '/dashboard/challenges',
    '/dashboard/ai-coach',
    '/dashboard/ai-coach/activity',
  ]) {
    try {
      revalidatePath(path)
    } catch {
      // Outside a request scope (e.g. a background call) — safe to skip.
    }
  }
}
