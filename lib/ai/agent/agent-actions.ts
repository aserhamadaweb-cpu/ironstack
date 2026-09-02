'use server'

import {
  cancelAgentAction,
  confirmAgentAction,
  undoAgentAction,
  type ConfirmResult,
  type UndoResult,
} from '@/lib/ai/agent/executor'
import { listAgentAuditEntries, type AgentAuditEntry } from '@/lib/ai/agent/audit'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Applies a queued change. This is the only client-reachable execute path. */
export async function confirmAgentActionAction(
  pendingActionId: string,
): Promise<ConfirmResult> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'You must be signed in.' }
  const id = pendingActionId.trim()
  if (!id) return { ok: false, error: 'Missing action id.' }
  return confirmAgentAction(userId, id)
}

export async function cancelAgentActionAction(
  pendingActionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'You must be signed in.' }
  const id = pendingActionId.trim()
  if (!id) return { ok: false, error: 'Missing action id.' }
  return cancelAgentAction(userId, id)
}

export async function undoAgentActionAction(
  auditId: string,
): Promise<UndoResult> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'You must be signed in.' }
  const id = auditId.trim()
  if (!id) return { ok: false, error: 'Missing action id.' }
  return undoAgentAction(userId, id)
}

export async function listAgentAuditAction(): Promise<{
  entries: AgentAuditEntry[]
  error?: string
}> {
  const userId = await requireUserId()
  if (!userId) return { entries: [], error: 'You must be signed in.' }
  return { entries: await listAgentAuditEntries(userId) }
}
