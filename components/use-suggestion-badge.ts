'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsGuest } from '@/components/use-is-guest'
import { getSuggestionBadgeAction } from '@/lib/ai/suggestion-actions'

/** Fired by the chat once suggestions have been seen, acted on, or dismissed. */
export const SUGGESTIONS_SEEN_EVENT = 'ironstack:suggestions-seen'

/**
 * Unread coach-suggestion count for indicators outside the chat.
 *
 * Read-only and deliberately cheap: a single count query, refreshed on mount,
 * on tab focus, and when the chat says it consumed them. No polling loop.
 */
export function useSuggestionBadge(): { count: number; refresh: () => void } {
  const { isGuest } = useIsGuest()
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    if (isGuest) {
      setCount(0)
      return
    }
    void getSuggestionBadgeAction()
      .then((result) => setCount(result.newCount))
      .catch(() => setCount(0))
  }, [isGuest])

  useEffect(() => {
    refresh()

    const onSeen = () => setCount(0)
    const onFocus = () => refresh()
    window.addEventListener(SUGGESTIONS_SEEN_EVENT, onSeen)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener(SUGGESTIONS_SEEN_EVENT, onSeen)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { count, refresh }
}
