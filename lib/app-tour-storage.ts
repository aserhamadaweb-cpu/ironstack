import type { User } from '@supabase/supabase-js'
import {
  clampTourStep,
  isAppTourStatus,
  type AppTourState,
  type AppTourStatus,
} from '@/lib/app-tour'
import { HOME_PATH } from '@/lib/onboarding-types'

/**
 * Read tour state from auth user_metadata.
 * Missing keys (existing accounts) → do not auto-offer the tour.
 */
export function readAppTourState(
  user: User | null | undefined,
): AppTourState {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const rawStatus = meta.app_tour_status
  const status = isAppTourStatus(rawStatus) ? rawStatus : null
  const step = clampTourStep(meta.app_tour_step)

  // Only first-time `pending` gets ?tour=1 / login redirects.
  // `active` resumes quietly from AppTourProvider; `deferred` stays silent
  // until Settings → Restart tour (or an explicit ?tour=1).
  const shouldAutoOffer = status === 'pending'

  return { status, step, shouldAutoOffer }
}

/** Dashboard home URL, with ?tour=1 when the user should see the app tour. */
export function homePathWithTourIfNeeded(
  user: User | null | undefined,
): string {
  const { shouldAutoOffer } = readAppTourState(user)
  return shouldAutoOffer ? `${HOME_PATH}?tour=1` : HOME_PATH
}

export function buildAppTourMetadataPatch(input: {
  status: AppTourStatus
  step: number
}): Record<string, unknown> {
  return {
    app_tour_status: input.status,
    app_tour_step: clampTourStep(input.step),
  }
}

/** Seed tour only when finishing onboarding for the first time. */
export function buildTourSeedAfterOnboarding(
  existingMeta: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  // Re-saving fitness profile after onboarding must not re-offer the tour.
  if (existingMeta?.onboarding_completed === true) {
    return {}
  }
  const current = existingMeta?.app_tour_status
  if (
    current === 'completed' ||
    current === 'skipped' ||
    current === 'active' ||
    current === 'pending' ||
    current === 'deferred'
  ) {
    return {}
  }
  return buildAppTourMetadataPatch({ status: 'pending', step: 0 })
}

/** Seed tour when a brand-new account is created (before onboarding finishes). */
export function buildTourSeedForNewAccount(): Record<string, unknown> {
  return buildAppTourMetadataPatch({ status: 'pending', step: 0 })
}

/** Append ?tour=1 when missing so the dashboard tour auto-starts. */
export function pathWithTourParam(path: string): string {
  if (path.includes('tour=1')) return path
  const url = new URL(path, 'http://local')
  url.searchParams.set('tour', '1')
  return `${url.pathname}${url.search}`
}
