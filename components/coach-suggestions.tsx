'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Lightbulb, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { safeDashboardHref } from '@/lib/ai/action-types'
import {
  actOnSuggestionAction,
  dismissSuggestionAction,
  getSuggestionsAction,
  markSuggestionsSeenAction,
} from '@/lib/ai/suggestion-actions'
import type { CoachSuggestion } from '@/lib/ai/suggestions'

type CoachSuggestionsProps = {
  /** Sends the suggestion's prompt as a normal chat message. */
  onAsk: (prompt: string) => void
  disabled?: boolean
}

/**
 * Proactive suggestions rendered inside the chat.
 *
 * "Ask about this" only types the prompt into the conversation — it never
 * executes. Anything the coach then proposes still needs a confirmation tap.
 */
export function CoachSuggestions({ onAsk, disabled = false }: CoachSuggestionsProps) {
  const t = useTranslations('coach')
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([])
  const [, startTransition] = useTransition()
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    let alive = true
    void (async () => {
      try {
        const result = await getSuggestionsAction()
        if (!alive) return
        setSuggestions(result.suggestions)
        if (result.newCount > 0) {
          await markSuggestionsSeenAction()
          // Let the nav badge drop straight away.
          window.dispatchEvent(new Event('ironstack:suggestions-seen'))
        }
      } catch {
        // A failed suggestion fetch is never worth interrupting the chat for.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (suggestions.length === 0) return null

  const dismiss = (id: string) => {
    setSuggestions((prev) => prev.filter((item) => item.id !== id))
    startTransition(async () => {
      await dismissSuggestionAction(id)
      window.dispatchEvent(new Event('ironstack:suggestions-seen'))
    })
  }

  const ask = (item: CoachSuggestion) => {
    if (disabled) return
    setSuggestions((prev) => prev.filter((row) => row.id !== item.id))
    if (item.prompt) onAsk(item.prompt)
    startTransition(async () => {
      await actOnSuggestionAction(item.id)
      window.dispatchEvent(new Event('ironstack:suggestions-seen'))
    })
  }

  return (
    <section aria-label={t('suggestionsTitle')} className="space-y-2">
      <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
        {t('suggestionsTitle')}
      </p>
      {suggestions.map((item) => {
        const href = safeDashboardHref(item.ctaHref)
        return (
          <div
            key={item.id}
            className="relative rounded-2xl border border-gold/20 bg-gold/[0.04] p-3.5 pe-10"
          >
            <button
              type="button"
              aria-label={t('suggestionDismiss')}
              onClick={() => dismiss(item.id)}
              className="absolute end-2 top-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <X className="size-3.5" />
            </button>

            <div className="flex items-start gap-2.5">
              <Lightbulb
                className="mt-0.5 size-4 shrink-0 text-gold"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-heading text-sm font-bold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.body}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.prompt ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => ask(item)}
                      className="inline-flex min-h-9 items-center rounded-full bg-primary px-3.5 text-[11px] font-bold tracking-[0.1em] text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    >
                      {t('suggestionAsk')}
                    </button>
                  ) : null}
                  {href ? (
                    <Link
                      href={href}
                      className="inline-flex min-h-9 items-center rounded-full border border-silver/25 px-3.5 text-[11px] font-semibold tracking-[0.1em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    >
                      {t('agentOpen')}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
