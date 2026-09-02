import { listAgentActions } from '@/lib/ai/agent/registry'

/** Action names that ship an inverse, so the UI can offer Undo. */
export function undoableActionNames(): Set<string> {
  return new Set(
    listAgentActions()
      .filter((action) => typeof action.undo === 'function')
      .map((action) => action.name),
  )
}
