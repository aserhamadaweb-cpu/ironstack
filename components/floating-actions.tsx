'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, Dumbbell, MessageSquare } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useActionFeedback } from '@/components/action-feedback'
import { useGuestGate } from '@/components/guest-gate-provider'
import { useMessageBadge } from '@/components/use-message-badge'
import { useSuggestionBadge } from '@/components/use-suggestion-badge'
import { useEmbeddedSessionActive } from '@/lib/offline/embedded-session'
import { useOfflineStatus } from '@/lib/offline/provider'

/** Hide during an in-progress workout so logging stays full-screen. */
function shouldHideFloating(pathname: string) {
  return /\/splits\/[^/]+\/session(?:\/|$)/.test(pathname)
}

function ChatAlert({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full border border-background bg-heat px-1 text-[10px] font-bold tabular-nums text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

type FloatingActionsProps = {
  onGuestMessages?: () => void
}

/** Messages + AI Coach, pinned above the bottom tab bar. */
export function FloatingActions({ onGuestMessages }: FloatingActionsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const reduce = useReducedMotion()
  const { isGuest, openUpgrade } = useGuestGate()
  const { online, hydrated } = useOfflineStatus()
  const { notifyError } = useActionFeedback()
  const tOffline = useTranslations('offline')
  const { count: suggestionCount } = useSuggestionBadge()
  const onMessages = pathname.startsWith('/dashboard/messages')
  const messageCount = useMessageBadge(onMessages)
  const [mounted, setMounted] = useState(false)
  const embeddedSession = useEmbeddedSessionActive()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || shouldHideFloating(pathname) || embeddedSession) return null

  const hideCoach = pathname.startsWith('/dashboard/ai-coach')
  const hideMessages = onMessages
  const offline = hydrated && !online

  const openCoach = () => {
    if (offline) {
      notifyError(tOffline('offlineBlocked.coach.title'))
      return
    }
    if (isGuest) {
      openUpgrade('aiCoach')
      return
    }
    router.push('/dashboard/ai-coach/chat')
  }

  return createPortal(
    <motion.div
      className="pointer-events-none fixed end-3 z-[55] flex flex-col items-center gap-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.75rem)] sm:end-6"
      initial={reduce ? false : { opacity: 0, scale: 0.5, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 18 }}
    >
      {!hideMessages &&
        (isGuest ? (
          <button
            type="button"
            aria-label="Messages"
            onClick={onGuestMessages ?? (() => openUpgrade('messages'))}
            className="pointer-events-auto relative inline-flex size-12 items-center justify-center rounded-full border border-gold/35 bg-card text-gold shadow-[0_8px_26px_-8px_rgba(0,0,0,0.7)] transition-transform duration-200 active:scale-95"
          >
            <ChatAlert count={messageCount} />
            <MessageSquare className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <Link
            href="/dashboard/messages"
            prefetch={false}
            aria-label={
              messageCount > 0
                ? `Messages — ${messageCount} new`
                : 'Messages'
            }
            className="pointer-events-auto relative inline-flex size-12 items-center justify-center rounded-full border border-gold/35 bg-card text-gold shadow-[0_8px_26px_-8px_rgba(0,0,0,0.7)] transition-transform duration-200 active:scale-95"
          >
            <ChatAlert count={messageCount} />
            <MessageSquare className="size-5" aria-hidden="true" />
          </Link>
        ))}

      {!hideCoach ? (
        <button
          type="button"
          aria-label={
            suggestionCount > 0
              ? `Open AI Coach — ${suggestionCount} new suggestions`
              : 'Open AI Coach'
          }
          onClick={openCoach}
          className="pointer-events-auto group relative inline-flex size-14 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-[0_8px_30px_-6px_rgba(242,241,237,0.35)] transition-transform duration-200 active:scale-95"
        >
          {!reduce && !offline ? (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary/40"
              animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden="true"
            />
          ) : null}
          <Bot className="size-7 text-primary-foreground" aria-hidden="true" />
          {suggestionCount > 0 && !offline ? (
            <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-gold px-1 text-[10px] font-bold tabular-nums text-background">
              {suggestionCount > 9 ? '9+' : suggestionCount}
            </span>
          ) : (
            <span className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-gold">
              <Dumbbell className="size-2.5 text-background" aria-hidden="true" />
            </span>
          )}
        </button>
      ) : null}
    </motion.div>,
    document.body,
  )
}
