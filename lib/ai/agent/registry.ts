/**
 * The allow-list.
 *
 * This module is the single place that decides what the AI coach may change.
 * `resolveAgentAction` is the only way to get an executable action, and it only
 * ever returns something present in `AGENT_ACTIONS`. Anything else — including
 * a plausible-looking name the model invents — resolves to a refusal.
 *
 * Adding an action here is the entire mechanism for granting a new capability,
 * which is why `scripts/verify-ai-boundaries.ts` asserts against this map.
 */

import { BODY_AGENT_ACTIONS } from '@/lib/ai/agent/actions-body'
import { PREFERENCE_AGENT_ACTIONS } from '@/lib/ai/agent/actions-preferences'
import { PROFILE_AGENT_ACTIONS } from '@/lib/ai/agent/actions-profile'
import { SOCIAL_AGENT_ACTIONS } from '@/lib/ai/agent/actions-social'
import { SPLIT_AGENT_ACTIONS } from '@/lib/ai/agent/actions-split'
import {
  blockedRefusal,
  matchBlockedCapability,
} from '@/lib/ai/agent/blocked'
import type { AnyAgentAction } from '@/lib/ai/agent/types'

const ALL_ACTIONS: AnyAgentAction[] = [
  ...SPLIT_AGENT_ACTIONS,
  ...BODY_AGENT_ACTIONS,
  ...PREFERENCE_AGENT_ACTIONS,
  ...PROFILE_AGENT_ACTIONS,
  ...SOCIAL_AGENT_ACTIONS,
]

export const AGENT_ACTIONS: ReadonlyMap<string, AnyAgentAction> = new Map(
  ALL_ACTIONS.map((action) => [action.name, action]),
)

if (AGENT_ACTIONS.size !== ALL_ACTIONS.length) {
  throw new Error('Duplicate agent action name in the registry.')
}

export function listAgentActionNames(): string[] {
  return [...AGENT_ACTIONS.keys()].sort()
}

export function listAgentActions(): AnyAgentAction[] {
  return [...AGENT_ACTIONS.values()]
}

export type AgentActionLookup =
  | { ok: true; action: AnyAgentAction }
  | {
      ok: false
      /** Refusal payload handed straight back to the model as a tool result. */
      refusal: Record<string, unknown>
    }

/**
 * Look up an action by name. The only sanctioned entry point.
 *
 * A name that is not in the allow-list never becomes executable, regardless of
 * how it is spelled. When the name looks like an attempt at a blocked
 * capability the refusal names it explicitly so the coach can point the athlete
 * at the right settings screen instead of retrying.
 */
export function resolveAgentAction(name: string): AgentActionLookup {
  const key = name.trim()
  const action = AGENT_ACTIONS.get(key)
  if (action) return { ok: true, action }

  const blocked = matchBlockedCapability(key)
  if (blocked) {
    return { ok: false, refusal: blockedRefusal(blocked) }
  }

  return {
    ok: false,
    refusal: {
      error: 'unsupported_action',
      message:
        `"${key}" is not something I can do. Tell the athlete you cannot do ` +
        `that from chat and suggest the closest thing you can do. Available ` +
        `actions: ${listAgentActionNames().join(', ')}.`,
    },
  }
}

/** True when the action notifies or is visible to another athlete. */
export function agentActionAffectsOthers(name: string): boolean {
  return AGENT_ACTIONS.get(name)?.affectsOthers === true
}
