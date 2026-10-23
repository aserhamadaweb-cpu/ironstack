'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsGuest } from '@/components/use-is-guest'
import { countUnseenIncomingMessagesAction } from '@/lib/data/social-actions'

const SEEN_KEY = 'ironstack-chat-seen-at'
const POLL_MS = 20_000

export function markChatSeen() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SEEN_KEY, new Date().toISOString())
  window.dispatchEvent(new Event('ironstack:chat-seen'))
}

function readChatSeen(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(SEEN_KEY)
}

/** Unread incoming DMs and group messages, cleared by opening Messages. */
export function useMessageBadge(onMessages: boolean): number {
  const { isGuest } = useIsGuest()
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    if (isGuest || onMessages) {
      setCount(0)
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    void countUnseenIncomingMessagesAction(readChatSeen())
      .then((result) => setCount(result.count))
      .catch(() => setCount(0))
  }, [isGuest, onMessages])

  useEffect(() => {
    if (onMessages) {
      markChatSeen()
      setCount(0)
      return
    }

    refresh()
    const onFocus = () => refresh()
    const onSeen = () => setCount(0)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('ironstack:chat-seen', onSeen)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('ironstack:chat-seen', onSeen)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [onMessages, refresh])

  return count
}
