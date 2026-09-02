'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Bot, Loader2, Send, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { CoachMascot } from '@/components/coach-mascot'
import { useGuestGate } from '@/components/guest-gate-provider'
import { EASE } from '@/components/reveal'
import type { SessionCoachContext } from '@/lib/ai/session-context'
import {
  markSessionCoachDiscovered,
  markSessionCoachTooltipShown,
  readSessionCoachHint,
  registerSessionCoachImpression,
  type SessionCoachHintState,
} from '@/lib/session-coach-hint'
import { initialsFrom } from '@/lib/dashboard-utils'

const TOOLTIP_DELAY_MS = 800
const TOOLTIP_VISIBLE_MS = 5000
/** Framer repeat: 2 → three pulse cycles (initial + 2 repeats). */
const PULSE_REPEAT = 2

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type SessionCoachChatProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  displayName: string
  sessionContext: SessionCoachContext
}

function isDesktopViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 640px)').matches
}

export function SessionCoachChat({
  open,
  onOpenChange,
  displayName,
  sessionContext,
}: SessionCoachChatProps) {
  const t = useTranslations('coach.sessionChat')
  const tCoach = useTranslations('coach')
  const { isGuest, openUpgrade } = useGuestGate()
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [hintState, setHintState] = useState<SessionCoachHintState | null>(null)
  const [showAttention, setShowAttention] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastAttempt = useRef<string | null>(null)
  const impressionRegistered = useRef(false)
  const tooltipInitiated = useRef(false)
  const tooltipTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTooltipTimers = useCallback(() => {
    for (const id of tooltipTimers.current) clearTimeout(id)
    tooltipTimers.current = []
  }, [])

  const markDiscovered = useCallback(() => {
    setHintState((prev) => {
      if (!prev) return prev
      return markSessionCoachDiscovered(prev)
    })
    setShowAttention(false)
    setTooltipVisible(false)
    clearTooltipTimers()
  }, [clearTooltipTimers])

  const dismissTooltip = useCallback(() => {
    setTooltipVisible(false)
    clearTooltipTimers()
    setHintState((prev) => {
      if (!prev) return prev
      return markSessionCoachTooltipShown(prev)
    })
  }, [clearTooltipTimers])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && isGuest) {
        openUpgrade('sessionCoach')
        return
      }
      if (next) {
        markDiscovered()
      }
      onOpenChange(next)
    },
    [isGuest, markDiscovered, onOpenChange, openUpgrade],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || impressionRegistered.current) return
    impressionRegistered.current = true
    const initial = readSessionCoachHint()
    const registered = registerSessionCoachImpression(initial)
    setHintState(registered)
    setShowAttention(registered.showAttention && !reduce)
  }, [mounted, reduce])

  useEffect(() => {
    if (!showAttention || reduce || open || tooltipInitiated.current) return
    if (hintState?.tooltipShown) return

    tooltipInitiated.current = true

    const showTimer = setTimeout(() => {
      setTooltipVisible(true)
      const hideTimer = setTimeout(() => {
        setTooltipVisible(false)
        setHintState((prev) => (prev ? markSessionCoachTooltipShown(prev) : prev))
      }, TOOLTIP_VISIBLE_MS)
      tooltipTimers.current.push(hideTimer)
    }, TOOLTIP_DELAY_MS)
    tooltipTimers.current.push(showTimer)

    return () => clearTooltipTimers()
  }, [clearTooltipTimers, hintState?.tooltipShown, open, reduce, showAttention])

  useEffect(() => {
    if (open) dismissTooltip()
  }, [dismissTooltip, open])

  useEffect(() => {
    return () => clearTooltipTimers()
  }, [clearTooltipTimers])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }, [messages, pending, open, reduce])

  useEffect(() => {
    if (!open || !isDesktopViewport()) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const sendMessage = (raw: string) => {
    const text = raw.trim()
    if (!text || pending) return
    markDiscovered()
    setError(null)
    setInput('')
    lastAttempt.current = text

    const optimisticId = `local-${Date.now()}`
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: optimisticId, role: 'user', content: text },
    ]
    setMessages(nextMessages)

    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            ephemeral: true,
            sessionContext,
            history: nextMessages
              .filter((m) => m.id !== optimisticId)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(
            data.error ||
              (res.status === 429 ? tCoach('errRateLimited') : tCoach('errReach')),
          )
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          return
        }

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          { id: optimisticId, role: 'user', content: text },
          {
            id: data.assistantMessage.id,
            role: 'assistant',
            content: data.assistantMessage.content,
          },
        ])
      } catch {
        setError(tCoach('errNetwork'))
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      }
    })
  }

  if (!mounted) return null

  const showChips = messages.length === 0
  const initials = initialsFrom(displayName)
  const showPulse = showAttention && !open && !reduce
  const showTooltip = tooltipVisible && !open && !reduce

  return createPortal(
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="session-coach-panel"
            className="fixed inset-0 z-[58] sm:inset-auto sm:end-3 sm:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:w-[min(100vw-1.5rem,24rem)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label={t('close')}
              className="absolute inset-0 bg-[var(--overlay-scrim)] sm:hidden"
              onClick={() => handleOpenChange(false)}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label={t('panelLabel')}
              initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] flex max-h-[min(720px,calc(100dvh-env(safe-area-inset-bottom)-5.75rem))] flex-col overflow-hidden rounded-2xl border border-silver/15 bg-background shadow-2xl sm:static sm:inset-auto sm:max-h-[min(440px,58dvh)] sm:w-full"
            >
              <header className="flex shrink-0 items-start gap-2 border-b border-silver/10 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-gold">
                    {t('kicker')}
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {sessionContext.currentExercise.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {sessionContext.dayName} · {sessionContext.splitName}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('close')}
                  onClick={() => handleOpenChange(false)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-silver/15 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  <X className="size-4" />
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {showChips ? (
                  <div className="rounded-xl border border-silver/10 bg-card/40 px-3 py-3 text-center">
                    <div className="mx-auto mb-2 flex size-14 items-center justify-center">
                      <CoachMascot className="size-12" idle />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {t('readyTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t('readyBody')}
                    </p>
                  </div>
                ) : null}

                {messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser ? (
                        <div
                          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-card p-0.5"
                          aria-hidden="true"
                        >
                          <CoachMascot className="size-7" />
                        </div>
                      ) : null}
                      <div
                        className={`max-w-[92%] rounded-2xl px-3 py-2 leading-relaxed sm:max-w-[85%] ${
                          isUser
                            ? 'text-sm'
                            : 'text-base sm:text-sm'
                        } ${
                          isUser
                            ? 'rounded-ee-md border border-blue/25 border-e-[3px] border-e-blue bg-card/95 text-foreground'
                            : 'rounded-es-md border border-silver/10 bg-card/80 text-foreground'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      {isUser ? (
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-silver/20 bg-card text-[9px] font-bold text-muted-foreground">
                          {initials}
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {pending ? (
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full border border-gold/30 bg-card p-0.5">
                      <CoachMascot className="size-7" />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-silver/10 bg-card/80 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {tCoach('thinking')}
                    </div>
                  </div>
                ) : null}

                <div ref={bottomRef} />
              </div>

              {showChips ? (
                <div className="shrink-0 border-t border-silver/10 px-3 py-2">
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[0, 1, 2].map((i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={pending}
                        onClick={() => sendMessage(t(`suggested.${i}` as 'suggested.0'))}
                        className="shrink-0 rounded-full border border-silver/15 bg-card/70 px-3 py-1.5 text-start text-[11px] leading-snug text-muted-foreground transition hover:border-blue/40 hover:text-blue disabled:opacity-50"
                      >
                        {t(`suggested.${i}` as 'suggested.0')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="shrink-0 border-t border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  <p>{error}</p>
                  {lastAttempt.current ? (
                    <button
                      type="button"
                      className="mt-1 font-semibold underline-offset-2 hover:underline"
                      onClick={() => sendMessage(lastAttempt.current ?? '')}
                    >
                      {tCoach('retry')}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <form
                className="shrink-0 border-t border-silver/10 bg-background/95 p-2.5 backdrop-blur-xl pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-2.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage(input)
                }}
              >
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(input)
                      }
                    }}
                    rows={1}
                    placeholder={t('placeholder')}
                    disabled={pending}
                    className="max-h-24 min-h-11 flex-1 resize-none rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={pending || !input.trim()}
                    aria-label={tCoach('send')}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold text-background transition hover:bg-gold/90 disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="pointer-events-none fixed end-3 z-[59] flex max-w-[calc(100vw-1.5rem)] items-center justify-end gap-2 bottom-[calc(env(safe-area-inset-bottom)+1rem)] sm:end-6"
        data-tour="session-coach-fab"
      >
        <AnimatePresence>
          {showTooltip ? (
            <motion.button
              key="session-coach-tooltip"
              type="button"
              initial={reduce ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 8 }}
              transition={{ duration: 0.22, ease: EASE }}
              onClick={() => {
                dismissTooltip()
                handleOpenChange(true)
              }}
              className="pointer-events-auto max-w-[min(14rem,calc(100vw-5.5rem))] rounded-full border border-gold/35 bg-card/95 px-3 py-2 text-[11px] font-semibold leading-snug text-foreground shadow-[0_8px_24px_-8px_rgba(0,0,0,0.65)] backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {t('hintTooltip')}
            </motion.button>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label={open ? t('close') : t('open')}
          aria-expanded={open}
          onClick={() => handleOpenChange(!open)}
          className="pointer-events-auto relative inline-flex size-12 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-[0_8px_30px_-6px_rgba(242,241,237,0.35)] transition active:scale-95"
          initial={reduce ? false : { opacity: 0, scale: 0.5, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
        >
          {showPulse ? (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary/40"
              animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
              transition={{
                duration: 1.8,
                repeat: PULSE_REPEAT,
                ease: 'easeOut',
              }}
              aria-hidden="true"
            />
          ) : null}
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Bot className="size-6" aria-hidden="true" />
          )}
        </motion.button>
      </div>
    </>,
    document.body,
  )
}
