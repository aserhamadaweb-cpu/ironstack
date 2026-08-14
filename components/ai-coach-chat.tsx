'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Brain,
  Database,
  History,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  Send,
  Trophy,
  Weight,
  X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { CoachMascot } from '@/components/coach-mascot'
import {
  CoachMemoryPanel,
  type MemoryItem,
} from '@/components/coach-memory-panel'
import { DashboardNav } from '@/components/dashboard-nav'
import { LtrIsolate } from '@/components/ltr-isolate'
import { EASE } from '@/components/reveal'
import { SUGGESTED_QUESTIONS } from '@/lib/ai/prompt'
import { initialsFrom } from '@/lib/dashboard-utils'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  usedTools?: boolean
}

type ConversationSummary = {
  id: string
  title: string | null
  updated_at: string
}

type AiCoachChatProps = {
  displayName: string
  initials: string
  conversationId: string | null
  initialMessages: ChatMessage[]
  initialConversations: ConversationSummary[]
  initialMemories: MemoryItem[]
}

type StatHint = { kind: 'lift' | 'streak'; count?: number; value: string }

function extractStatHints(text: string) {
  const hints: StatHint[] = []
  const pr = text.match(/(\d+(?:\.\d+)?)\s*kg\s*[×x]\s*(\d+)/i)
  if (pr) {
    hints.push({ kind: 'lift', value: `${pr[1]} kg × ${pr[2]}` })
  }
  const streak =
    text.match(/(\d+)\s*-?\s*day streak/i) || text.match(/(\d+)\s*أيام/)
  if (streak) {
    hints.push({ kind: 'streak', count: Number(streak[1]), value: streak[1] })
  }
  return hints.slice(0, 2)
}

type CoachT = ReturnType<typeof useTranslations<'coach'>>

function relativeUpdatedAt(iso: string, t: CoachT) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (diffSec < 60) return t('justNow')
  const mins = Math.round(diffSec / 60)
  if (mins < 60) return t('minsAgo', { count: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('hoursAgo', { count: hours })
  const days = Math.round(hours / 24)
  if (days < 7) return t('daysAgo', { count: days })
  const short = new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return <LtrIsolate>{short}</LtrIsolate>
}

export function AiCoachChat({
  displayName,
  initials,
  conversationId: initialConversationId,
  initialMessages,
  initialConversations,
  initialMemories,
}: AiCoachChatProps) {
  const t = useTranslations('coach')
  const locale = useLocale()
  const reduce = useReducedMotion()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations)
  const [memories, setMemories] = useState(initialMemories)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [switching, setSwitching] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [messages, pending, reduce])

  const showChips = messages.length <= 2
  const showEmpty = messages.length === 0
  const drawerX = locale === 'ar' ? 280 : -280
  const activeTitle =
    conversations.find((c) => c.id === conversationId)?.title || t('newChat')

  const syncConversations = (list: ConversationSummary[] | undefined) => {
    if (Array.isArray(list)) setConversations(list)
  }

  const startNewChat = () => {
    if (pending || switching) return
    setError(null)
    setSwitching(true)
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'new' }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || t('errNewChat'))
          return
        }
        setConversationId(data.conversationId)
        setMessages([])
        syncConversations(data.conversations)
        setHistoryOpen(false)
      } catch {
        setError(t('errNewChatNetwork'))
      } finally {
        setSwitching(false)
      }
    })
  }

  const loadConversation = (id: string) => {
    if (pending || switching || id === conversationId) {
      setHistoryOpen(false)
      return
    }
    setError(null)
    setSwitching(true)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/ai-coach?conversationId=${encodeURIComponent(id)}`,
        )
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || t('errLoadChat'))
          return
        }
        setConversationId(data.conversationId)
        setMessages(data.messages ?? [])
        syncConversations(data.conversations)
        setHistoryOpen(false)
      } catch {
        setError(t('errLoadChatNetwork'))
      } finally {
        setSwitching(false)
      }
    })
  }

  const sendMessage = (raw: string) => {
    const text = raw.trim()
    if (!text || pending || switching) return
    setError(null)
    setInput('')

    const optimisticId = `local-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ])

    startTransition(async () => {
      try {
        const res = await fetch('/api/ai-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationId,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(
            data.error ||
              (res.status === 429 ? t('errRateLimited') : t('errReach')),
          )
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          return
        }

        setConversationId(data.conversationId ?? conversationId)
        syncConversations(data.conversations)
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId)
          return [
            ...withoutOptimistic,
            {
              id: data.userMessage.id,
              role: 'user',
              content: data.userMessage.content,
              createdAt: data.userMessage.createdAt,
            },
            {
              id: data.assistantMessage.id,
              role: 'assistant',
              content: data.assistantMessage.content,
              createdAt: data.assistantMessage.createdAt,
              usedTools: Boolean(data.assistantMessage.usedTools),
            },
          ]
        })
      } catch {
        setError(t('errNetwork'))
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      }
    })
  }

  const historyPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-silver/10 px-3 py-3">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
          {t('history')}
        </p>
        <button
          type="button"
          onClick={startNewChat}
          disabled={pending || switching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[11px] font-semibold text-gold transition hover:border-gold/60 hover:bg-gold/15 disabled:opacity-50"
        >
          <MessageSquarePlus className="size-3.5" />
          {t('newChat')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t('noChats')}
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => {
              const active = c.id === conversationId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => loadConversation(c.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-start transition-colors ${
                      active
                        ? 'border border-gold/25 bg-gold/[0.08]'
                        : 'border border-transparent hover:bg-card/80'
                    }`}
                  >
                    <p
                      className={`truncate text-sm ${
                        active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {c.title?.trim() || t('newChat')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {relativeUpdatedAt(c.updated_at, t)}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-silver/10 p-3">
        <button
          type="button"
          onClick={() => setMemoryOpen((v) => !v)}
          className="mb-2 flex w-full items-center gap-2 text-start text-[10px] font-semibold tracking-[0.18em] text-muted-foreground transition hover:text-gold"
        >
          <Brain className="size-3.5" />
          {t('whatIRemember')}
        </button>
        {memoryOpen && (
          <CoachMemoryPanel
            memories={memories}
            compact
            onChanged={setMemories}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="relative flex min-h-svh flex-col pb-24 md:pb-0">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(232,181,74,0.12),transparent_55%)]" />
        <div className="absolute top-[35%] -end-28 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[15%] start-[-5rem] h-72 w-72 rounded-full bg-blue/[0.04] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-6">
        <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
              {t('kicker')}
            </p>
            <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t('brandTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('tagline')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-silver/15 bg-card/70 px-3 text-xs font-semibold text-muted-foreground transition active:border-gold/40 active:text-gold lg:hidden"
            >
              {historyOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <History className="size-4" />
              )}
              {t('historyMobile')}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Desktop history sidebar */}
          <aside className="hidden w-64 shrink-0 overflow-hidden rounded-2xl border border-silver/10 bg-background/50 lg:flex lg:flex-col">
            {historyPanel}
          </aside>

          {/* Mobile history drawer */}
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                className="fixed inset-0 z-40 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  aria-label={t('closeHistory')}
                  className="absolute inset-0 bg-[var(--overlay-scrim)]"
                  onClick={() => setHistoryOpen(false)}
                />
                <motion.aside
                  initial={{ x: drawerX }}
                  animate={{ x: 0 }}
                  exit={{ x: drawerX }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="absolute inset-y-0 start-0 flex w-[min(20rem,88vw)] flex-col border-e border-silver/10 bg-background shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-silver/10 px-3 py-3">
                    <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                      {t('chats')}
                    </span>
                    <button
                      type="button"
                      aria-label={t('close')}
                      onClick={() => setHistoryOpen(false)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {historyPanel}
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-silver/10 bg-background/50">
            <div className="flex items-center gap-2 border-b border-silver/10 px-3 py-2.5 sm:px-4">
              <PanelLeft className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <p className="truncate text-xs text-muted-foreground">{activeTitle}</p>
              {(pending || switching) && (
                <Loader2 className="ms-auto size-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
              {showEmpty && (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <div className="mb-4 flex size-36 items-center justify-center sm:size-40">
                    <CoachMascot className="size-32 sm:size-36" idle />
                  </div>
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {t('readyTitle', { name: displayName.split(/\s+/)[0] })}
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    {t('readyBody')}
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  const usedTools = Boolean(msg.usedTools)
                  const hints = !isUser ? extractStatHints(msg.content) : []
                  return (
                    <motion.div
                      key={msg.id}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div
                          className="mt-0.5 flex size-10 shrink-0 items-center justify-center overflow-visible rounded-full border border-gold/30 bg-card p-0.5"
                          aria-hidden="true"
                        >
                          <CoachMascot className="size-9" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] ${
                          isUser ? 'items-end' : 'items-start'
                        } flex flex-col gap-2`}
                      >
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isUser
                              ? 'rounded-ee-md border border-blue/25 border-e-[3px] border-e-blue bg-card/95 text-foreground'
                              : usedTools
                                ? 'rounded-es-md border border-blue/30 border-s-[3px] border-s-blue bg-card/80 text-foreground'
                                : 'rounded-es-md border border-silver/10 bg-card/80 text-foreground'
                          }`}
                        >
                          {!isUser && usedTools && (
                            <span className="mb-2 inline-flex items-center gap-1 rounded-md border border-blue/35 bg-blue-tint px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-blue">
                              <Database
                                className="size-2.5"
                                aria-hidden="true"
                              />
                              {t('liveData')}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {hints.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {hints.map((hint, i) => (
                              <div
                                key={`${hint.kind}-${i}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-3 py-1.5"
                              >
                                {hint.kind === 'streak' ? (
                                  <Trophy className="size-3.5 text-success" />
                                ) : (
                                  <Weight className="size-3.5 text-success" />
                                )}
                                <div>
                                  <p className="text-[9px] font-semibold tracking-[0.14em] text-success/90">
                                    {hint.kind === 'streak'
                                      ? t('hintStreak')
                                      : t('hintLift')}
                                  </p>
                                  <p className="font-heading text-xs font-bold tabular-nums text-foreground">
                                    <LtrIsolate>
                                      {hint.kind === 'streak'
                                        ? t('hintStreakValue', {
                                            count: hint.count ?? 0,
                                          })
                                        : hint.value}
                                    </LtrIsolate>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {isUser && (
                        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-silver/20 bg-card text-[10px] font-bold text-muted-foreground">
                          {initialsFrom(displayName)}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {pending && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="flex items-center gap-2.5"
                >
                  <div
                    className="flex size-10 items-center justify-center overflow-visible rounded-full border border-gold/30 bg-card p-0.5"
                    aria-hidden="true"
                  >
                    <CoachMascot className="size-9" />
                  </div>
                  <div
                    className="inline-flex items-center gap-3 rounded-2xl rounded-es-md border border-silver/10 bg-card/80 px-4 py-3"
                    aria-live="polite"
                    aria-label={t('thinking')}
                  >
                    <span className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="size-1.5 rounded-full bg-gold"
                          animate={
                            reduce
                              ? { opacity: 0.5 }
                              : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }
                          }
                          transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('thinking')}
                    </span>
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {showChips && (
              <div className="shrink-0 border-t border-silver/10 px-3 py-3 sm:px-4">
                <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                  {t('tryAsking')}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
                  {SUGGESTED_QUESTIONS.map((q, i) => {
                    const label = t(`suggested.${i}` as 'suggested.0')
                    return (
                    <motion.button
                      key={q}
                      type="button"
                      disabled={pending || switching}
                      onClick={() => sendMessage(label)}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: reduce ? 0 : i * 0.05,
                        ease: EASE,
                      }}
                      className="shrink-0 rounded-full border border-silver/15 bg-card/70 px-3 py-2 text-start text-xs text-muted-foreground transition-colors hover:border-blue/50 hover:bg-blue-tint/60 hover:text-blue disabled:opacity-50"
                    >
                      {label}
                    </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="shrink-0 border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <form
              className="sticky bottom-0 shrink-0 border-t border-silver/10 bg-background/90 p-3 backdrop-blur-xl sm:p-4"
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
                  placeholder={t('askPlaceholder')}
                  disabled={pending || switching}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={pending || switching || !input.trim()}
                  aria-label={t('send')}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold text-background transition hover:bg-gold/90 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {t('disclaimer')}
              </p>
            </form>
          </div>
        </div>
      </div>

    </div>
  )
}
