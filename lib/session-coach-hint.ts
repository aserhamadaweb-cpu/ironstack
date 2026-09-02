export const SESSION_COACH_HINT_KEY = 'ironstack:session-coach-hint'

export const SESSION_COACH_HINT_MAX_IMPRESSIONS = 3

export type SessionCoachHintState = {
  impressions: number
  discovered: boolean
  tooltipShown: boolean
}

const EMPTY: SessionCoachHintState = {
  impressions: 0,
  discovered: false,
  tooltipShown: false,
}

export function readSessionCoachHint(): SessionCoachHintState {
  if (typeof window === 'undefined') return { ...EMPTY }
  try {
    const raw = window.localStorage.getItem(SESSION_COACH_HINT_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<SessionCoachHintState>
    return {
      impressions: Math.max(0, Math.min(SESSION_COACH_HINT_MAX_IMPRESSIONS, Number(parsed.impressions) || 0)),
      discovered: Boolean(parsed.discovered),
      tooltipShown: Boolean(parsed.tooltipShown),
    }
  } catch {
    return { ...EMPTY }
  }
}

export function writeSessionCoachHint(state: SessionCoachHintState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      SESSION_COACH_HINT_KEY,
      JSON.stringify({
        impressions: Math.max(
          0,
          Math.min(SESSION_COACH_HINT_MAX_IMPRESSIONS, state.impressions),
        ),
        discovered: Boolean(state.discovered),
        tooltipShown: Boolean(state.tooltipShown),
      }),
    )
  } catch {
    /* private mode */
  }
}

/** True while pulse / tooltip hints may still show. */
export function sessionCoachHintActive(state: SessionCoachHintState): boolean {
  return !state.discovered && state.impressions < SESSION_COACH_HINT_MAX_IMPRESSIONS
}

/**
 * Call once when the lift screen coach FAB mounts.
 * Returns updated state and whether this mount should show attention cues.
 */
export function registerSessionCoachImpression(
  state: SessionCoachHintState,
): SessionCoachHintState & { showAttention: boolean } {
  if (state.discovered || state.impressions >= SESSION_COACH_HINT_MAX_IMPRESSIONS) {
    return { ...state, showAttention: false }
  }
  const next = {
    ...state,
    impressions: state.impressions + 1,
  }
  writeSessionCoachHint(next)
  return { ...next, showAttention: true }
}

export function markSessionCoachDiscovered(
  state: SessionCoachHintState,
): SessionCoachHintState {
  if (state.discovered) return state
  const next = { ...state, discovered: true }
  writeSessionCoachHint(next)
  return next
}

export function markSessionCoachTooltipShown(
  state: SessionCoachHintState,
): SessionCoachHintState {
  if (state.tooltipShown) return state
  const next = { ...state, tooltipShown: true }
  writeSessionCoachHint(next)
  return next
}
