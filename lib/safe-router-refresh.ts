'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { hasRecentNavigationIntent } from '@/lib/navigation-intent'

type SafeRefreshOptions = {
  /** Wait before the first attempt. */
  delayMs?: number
  /** Treat navigation within this window as still in progress. */
  graceMs?: number
  /** Give up after this long so a refresh is never retried forever. */
  maxWaitMs?: number
}

const RETRY_INTERVAL_MS = 1_000

/**
 * Runs router.refresh() once the user's navigation has settled.
 *
 * A refresh that lands mid-navigation can paint the previous route's RSC
 * payload, which reads as the app "going back". Rather than dropping the
 * refresh, it is deferred until navigation is idle (or abandoned once stale).
 */
export function safeRouterRefresh(
  router: AppRouterInstance,
  options: SafeRefreshOptions = {},
) {
  const { delayMs = 0, graceMs = 2_500, maxWaitMs = 15_000 } = options
  const deadline = Date.now() + maxWaitMs

  const attempt = () => {
    if (!hasRecentNavigationIntent(graceMs)) {
      router.refresh()
      return
    }
    if (Date.now() >= deadline) return
    window.setTimeout(attempt, RETRY_INTERVAL_MS)
  }

  window.setTimeout(attempt, delayMs)
}
