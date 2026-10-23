'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { isNavigationInFlight, isRouteLoading } from '@/lib/navigation-intent'

type SafeRefreshOptions = {
  /** Wait before the first attempt. */
  delayMs?: number
  /** Give up after this long so a refresh is never retried forever. */
  maxWaitMs?: number
}

const RETRY_INTERVAL_MS = 400

/**
 * Runs router.refresh() once the user's navigation has settled.
 *
 * A refresh that lands mid-navigation can paint the previous route's RSC
 * payload, which reads as the app "going back". Skip the refresh if a
 * transition is still in flight when the wait cap is hit — do not force it.
 */
export function safeRouterRefresh(
  router: AppRouterInstance,
  options: SafeRefreshOptions = {},
) {
  const { delayMs = 0, maxWaitMs = 15_000 } = options
  const deadline = Date.now() + maxWaitMs

  const attempt = () => {
    if (!isNavigationInFlight() && !isRouteLoading()) {
      router.refresh()
      return
    }
    if (Date.now() >= deadline) return
    window.setTimeout(attempt, RETRY_INTERVAL_MS)
  }

  window.setTimeout(attempt, delayMs)
}
