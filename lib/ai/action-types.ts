/** Structured coach actions. Gemini may propose these; only confirm endpoints persist. */

import type { AgentPreview } from '@/lib/ai/agent/types'

export type { AgentPreview }

export type SplitProposalExercise = {
  exerciseId: string
  name: string
  equipment: string
  muscle: string
  sets: number
  reps: string
  homeSuitable: boolean
}

export type SplitProposalDay = {
  name: string
  subtitle: string | null
  exercises: SplitProposalExercise[]
}

export type SplitProposalSource =
  | 'prs'
  | 'history'
  | 'preferences'
  | 'catalog_defaults'
  | 'mixed'

export type SplitProposal = {
  id: string
  kind: 'create_split' | 'update_split'
  splitId: string
  name: string
  description: string
  daysPerWeek: number
  days: SplitProposalDay[]
  assumptions: string[]
  questions: string[]
  basedOn: SplitProposalSource
  /** Safety/substitution notes from profile-aware enforcement. */
  warnings?: string[]
}

export type SessionProposalKind =
  | 'open_split'
  | 'start_session'
  | 'resume_session'
  | 'discard_session'

export type SessionProposal = {
  id: string
  kind: SessionProposalKind
  href?: string
  splitId?: string
  sessionId?: string
  splitName?: string
  dayName?: string
  warning?: string
}

/**
 * A queued change from the generic agent registry, awaiting confirmation.
 * `pendingActionId` is the single-use row in `ai_pending_actions`; the client
 * only ever sends that id back, never the change itself.
 */
export type AgentActionCard = {
  type: 'agent_action'
  pendingActionId: string
  actionName: string
  preview: AgentPreview
  status: 'pending' | 'applied' | 'cancelled' | 'expired' | 'failed'
  /** Audit row id, present once applied — enables Undo. */
  auditId?: string
  summary?: string
  href?: string
  undoable?: boolean
  undone?: boolean
}

export type CoachUiAction =
  | {
      type: 'split_preview'
      proposal: SplitProposal
      status: 'pending' | 'saved' | 'cancelled'
      splitHref?: string
    }
  | {
      type: 'session_preview'
      proposal: SessionProposal
      status: 'pending' | 'done' | 'cancelled'
    }
  | AgentActionCard

export function isAgentPreview(value: unknown): value is AgentPreview {
  if (!value || typeof value !== 'object') return false
  const row = value as AgentPreview
  return (
    typeof row.title === 'string' &&
    row.title.trim().length > 0 &&
    Array.isArray(row.changes) &&
    typeof row.confirmLabel === 'string'
  )
}

export function isSplitProposal(value: unknown): value is SplitProposal {
  if (!value || typeof value !== 'object') return false
  const row = value as SplitProposal
  return (
    (row.kind === 'create_split' || row.kind === 'update_split') &&
    typeof row.id === 'string' &&
    row.id.trim().length > 0 &&
    typeof row.splitId === 'string' &&
    row.splitId.trim().length > 0 &&
    typeof row.name === 'string' &&
    Array.isArray(row.days) &&
    row.days.length > 0
  )
}

export function isSessionProposal(value: unknown): value is SessionProposal {
  if (!value || typeof value !== 'object') return false
  const row = value as SessionProposal
  return (
    typeof row.id === 'string' &&
    (row.kind === 'open_split' ||
      row.kind === 'start_session' ||
      row.kind === 'resume_session' ||
      row.kind === 'discard_session')
  )
}

export function safeDashboardHref(href: string | null | undefined): string | null {
  if (!href) return null
  const path = href.trim()
  if (!path.startsWith('/dashboard/')) return null
  if (path.startsWith('//') || path.includes('://')) return null
  if (path.includes('\\') || path.includes('\n') || path.includes('\r')) return null
  return path
}
