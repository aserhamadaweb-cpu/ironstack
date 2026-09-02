/**
 * Shared contracts for AI agent actions.
 *
 * An "agent action" is something the coach can change on the athlete's behalf.
 * Every one follows the same three-phase shape:
 *
 *   prepare  — validate model-supplied args, snapshot current state, describe
 *              the change. Read-only. Runs while the coach is still talking.
 *   execute  — apply the change. Runs ONLY after explicit confirmation.
 *   undo     — restore the snapshot. Optional; absent means irreversible.
 *
 * Actions never receive a user id from the model. The executor injects the
 * authenticated id, and every underlying call uses the athlete's own Supabase
 * session so RLS applies exactly as it does in the UI.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type AgentActionDomain =
  | 'split'
  | 'session'
  | 'body'
  | 'preference'
  | 'profile'
  | 'memory'
  | 'social'

/** What the athlete sees on the confirmation card before anything happens. */
export type AgentPreview = {
  title: string
  /** Exact changes, one line each. Must be specific enough to consent to. */
  changes: string[]
  /** Extra caution copy for destructive or visibility-changing actions. */
  warning?: string
  /** Whether an Undo button appears after execution. */
  undoable: boolean
  /** Short label for the confirm button, e.g. "Log weight". */
  confirmLabel: string
  /** Renders the confirm button in destructive styling. */
  destructive?: boolean
}

export type AgentContext = {
  userId: string
}

export type AgentPrepared<A> = {
  ok: true
  args: A
  preview: AgentPreview
  /** Snapshot used for undo and for the audit `before_state` column. */
  before: JsonValue
}

export type AgentFailure = {
  ok: false
  error: string
  /** Machine code for client-side message mapping, e.g. `split_limit_reached`. */
  code?: string
}

export type AgentExecuted = {
  ok: true
  /** One-line past-tense description written to the audit log. */
  summary: string
  after: JsonValue
  /** Dashboard path to offer as a follow-up link. */
  href?: string
}

export type AgentUndoInput = {
  args: Record<string, unknown>
  before: JsonValue
  after: JsonValue
}

export type AgentActionDefinition<A> = {
  name: string
  domain: AgentActionDomain
  /**
   * True when the change is visible to, or notifies, another athlete.
   * Gated separately from own-data actions.
   */
  affectsOthers?: boolean
  prepare(
    ctx: AgentContext,
    raw: Record<string, unknown>,
  ): Promise<AgentPrepared<A> | AgentFailure>
  execute(
    ctx: AgentContext,
    prepared: AgentPrepared<A>,
  ): Promise<AgentExecuted | AgentFailure>
  undo?(
    ctx: AgentContext,
    input: AgentUndoInput,
  ): Promise<AgentExecuted | AgentFailure>
}

/** Type-erased definition for storage in the registry map. */
export type AnyAgentAction = AgentActionDefinition<Record<string, unknown>>

/**
 * Registers an action while keeping its argument type checked inside the
 * definition body.
 */
export function defineAgentAction<A>(
  def: AgentActionDefinition<A>,
): AnyAgentAction {
  return def as unknown as AnyAgentAction
}

export function fail(error: string, code?: string): AgentFailure {
  return { ok: false, error, code }
}

/** Narrow helper — `prepare` results are unions and get checked a lot. */
export function isFailure(
  value: { ok: true } | AgentFailure,
): value is AgentFailure {
  return value.ok === false
}
