'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lightbulb, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { EASE } from '@/components/reveal'
import { useSuggestionBadge } from '@/components/use-suggestion-badge'

/** Once per browser session — the FAB badge carries it from then on. */
const SESSION_KEY = 'ironstack:coach-suggestion-toast'

/**
 * One-shot nudge for athletes who never open the chat.
 *
 * Purely an attention cue: it links to the coach and cannot act on anything.
 */
export function CoachSuggestionToast() {
  const t = useTranslations('coach')
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const { count } = useSuggestionBadge()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(sessionStorage.getItem(SESSION_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  const close = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // Private-mode storage failure just means it may show again later.
    }
  }

  const visible =
    mounted && !dismissed && count > 0 && !pathname.startsWith('/dashboard/ai-coach')

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="fixed inset-x-3 z-[56] mx-auto flex max-w-sm items-start gap-2.5 rounded-2xl border border-gold/30 bg-card/95 p-3 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.75)] backdrop-blur bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.75rem)] sm:inset-x-auto sm:end-24"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/15">
            <Lightbulb className="size-3.5 text-gold" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-foreground">
              {t('suggestionBannerTitle')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('suggestionBadge', { count })}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Link
                href="/dashboard/ai-coach/chat"
                onClick={close}
                className="inline-flex min-h-11 items-center rounded-full bg-primary px-3.5 text-[11px] font-bold tracking-[0.1em] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {t('suggestionBannerCta')}
              </Link>
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {t('suggestionBannerDismiss')}
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('suggestionBannerDismiss')}
            onClick={close}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
