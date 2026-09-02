import { createClient } from '@/lib/supabase/server'
import { undoableActionNames } from '@/lib/ai/agent/undoable'
import type { JsonValue } from '@/lib/ai/agent/types'

export type AgentAuditEntry = {
  id: string
  actionName: string
  summary: string
  /** The athlete's own words that triggered the change. */
  requestText: string | null
  status: 'executed' | 'failed' | 'undone'
  error: string | null
  createdAt: string
  /** Set when a later entry reversed this one. */
  undoneByAuditId: string | null
  /** Set when this entry is itself an undo of an earlier action. */
  undoOfAuditId: string | null
  canUndo: boolean
  before: JsonValue
  after: JsonValue
}

type Row = {
  id: string
  action_name: string
  summary: string
  request_text: string | null
  status: string
  error: string | null
  created_at: string
  undo_of: string | null
  before_state: JsonValue
  after_state: JsonValue
}

/**
 * Full history of what the coach changed, newest first.
 *
 * Undo relationships are derived rather than stored on the original row —
 * the table is append-only, so a reversal is a separate entry pointing back
 * via `undo_of`.
 */
export async function listAgentAuditEntries(
  userId: string,
  limit = 50,
): Promise<AgentAuditEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_action_audit')
    .select(
      'id, action_name, summary, request_text, status, error, created_at, undo_of, before_state, after_state',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[agent audit] read failed', error.message)
    return []
  }

  const rows = (data ?? []) as Row[]
  const undoneBy = new Map<string, string>()
  for (const row of rows) {
    if (row.undo_of) undoneBy.set(row.undo_of, row.id)
  }

  const undoable = undoableActionNames()

  return rows.map((row) => ({
    id: row.id,
    actionName: row.action_name,
    summary: row.summary,
    requestText: row.request_text,
    status: row.status as AgentAuditEntry['status'],
    error: row.error,
    createdAt: row.created_at,
    undoneByAuditId: undoneBy.get(row.id) ?? null,
    undoOfAuditId: row.undo_of,
    canUndo:
      row.status === 'executed' &&
      !row.undo_of &&
      !undoneBy.has(row.id) &&
      undoable.has(row.action_name),
    before: row.before_state,
    after: row.after_state,
  }))
}

export async function countUndoableAgentActions(userId: string): Promise<number> {
  const entries = await listAgentAuditEntries(userId, 20)
  return entries.filter((entry) => entry.canUndo).length
}
