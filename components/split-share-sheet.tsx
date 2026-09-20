'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Check,
  Copy,
  Globe2,
  Loader2,
  MessageSquare,
  Send,
  Share2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useGuestGate } from '@/components/guest-gate-provider'
import { UserAvatar } from '@/components/user-avatar'
import {
  ensureSplitShareReady,
  listShareConversationTargetsAction,
  shareSplitToTargetsAction,
  type ShareConversationTarget,
  type ShareSplitTargetInput,
} from '@/lib/data/split-share'

type SplitShareSheetProps = {
  open: boolean
  onClose: () => void
  splitId: string
  splitName: string
  daysPerWeek: number
  category?: string | null
  /** When set, show Share to profile inside this sheet. */
  isSharedOnProfile?: boolean
  profileSharePending?: boolean
  onToggleProfileShare?: () => void
}

type SheetStep = 'menu' | 'messages'

export function SplitShareSheet({
  open,
  onClose,
  splitId,
  splitName,
  daysPerWeek,
  category,
  isSharedOnProfile = false,
  profileSharePending = false,
  onToggleProfileShare,
}: SplitShareSheetProps) {
  const t = useTranslations('splitShare')
  const { isGuest, openUpgrade } = useGuestGate()
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState<SheetStep>('menu')
  const [targets, setTargets] = useState<ShareConversationTarget[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sendResults, setSendResults] = useState<
    Array<{ targetId: string; label: string; ok: boolean; error?: string }>
  >([])
  const [pending, startTransition] = useTransition()

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (open && isGuest) {
      onClose()
      openUpgrade('shareSplit')
    }
  }, [open, isGuest, onClose, openUpgrade])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setStep('menu')
      setSelected(new Set())
      setNote('')
      setShareUrl(null)
      setCopyState('idle')
      setError(null)
      setSendResults([])
      return
    }

    startTransition(async () => {
      const ready = await ensureSplitShareReady(splitId)
      if (ready.ok) {
        setShareUrl(ready.shareUrl)
      } else {
        setError(ready.error)
      }
    })
  }, [open, splitId])

  useEffect(() => {
    if (!open || step !== 'messages') return
    setLoadingTargets(true)
    void listShareConversationTargetsAction().then((result) => {
      setTargets(result.targets)
      if (result.error) setError(result.error)
      setLoadingTargets(false)
    })
  }, [open, step])

  const selectedTargets = useMemo(
    () => targets.filter((t) => selected.has(t.id)),
    [targets, selected],
  )

  const toggleTarget = (target: ShareConversationTarget) => {
    if (!target.canSend) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(target.id)) next.delete(target.id)
      else next.add(target.id)
      return next
    })
    setSendResults((prev) => prev.filter((r) => r.targetId !== target.id))
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    setCopyState('idle')
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
    }
  }

  const handleNativeShare = async () => {
    if (!shareUrl || !canNativeShare) return
    setError(null)
    try {
      await navigator.share({
        title: splitName,
        text: t('shareText', { name: splitName }),
        url: shareUrl,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(t('shareFailed'))
    }
  }

  const handleSendToMessages = () => {
    if (selected.size === 0) return
    setError(null)
    setSendResults([])
    const payload: ShareSplitTargetInput[] = selectedTargets.map((target) =>
      target.kind === 'group'
        ? { kind: 'group', groupId: target.groupId! }
        : {
            kind: 'dm',
            otherUserId: target.otherUserId!,
            threadId: target.threadId,
          },
    )

    startTransition(async () => {
      const result = await shareSplitToTargetsAction({
        splitId,
        note: note.trim() || undefined,
        targets: payload,
      })
      if (result.shareUrl) setShareUrl(result.shareUrl)
      setSendResults(result.results)
      if (result.error && result.results.length === 0) {
        setError(result.error)
        return
      }
      if (result.results.every((r) => r.ok)) {
        window.setTimeout(() => onClose(), 700)
      }
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <button
            type="button"
            aria-label={t('close')}
            className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-share-title"
            className="relative z-10 flex max-h-[88svh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-silver/15 bg-card shadow-2xl sm:rounded-2xl"
            initial={
              reduceMotion ? false : { opacity: 0, y: 40, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, scale: 0.98 }
            }
          >
            <header className="flex items-start justify-between gap-3 border-b border-silver/10 px-4 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                  {t('kicker')}
                </p>
                <h2
                  id="split-share-title"
                  className="font-heading mt-1 truncate text-lg font-bold text-foreground"
                >
                  {splitName}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('meta', {
                    days: daysPerWeek,
                    category: category || t('customCategory'),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-background hover:text-foreground"
                aria-label={t('close')}
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {step === 'menu' ? (
                <div className="space-y-3">
                  {onToggleProfileShare ? (
                    <button
                      type="button"
                      disabled={profileSharePending || pending}
                      onClick={onToggleProfileShare}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition disabled:opacity-60 ${
                        isSharedOnProfile
                          ? 'border-blue/35 bg-blue-tint/30 hover:border-blue/50'
                          : 'border-silver/15 bg-background/40 hover:border-gold/35 hover:bg-background/70'
                      }`}
                    >
                      <span
                        className={`flex size-10 items-center justify-center rounded-xl ${
                          isSharedOnProfile
                            ? 'bg-blue-tint/60 text-blue'
                            : 'bg-background/80 text-muted-foreground'
                        }`}
                      >
                        {profileSharePending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <UserRound className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {isSharedOnProfile
                            ? t('profileShared')
                            : t('shareToProfile')}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {isSharedOnProfile
                            ? t('profileSharedHint')
                            : t('shareToProfileHint')}
                        </span>
                      </span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setStep('messages')}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-silver/15 bg-background/40 px-4 py-3 text-start transition hover:border-gold/35 hover:bg-background/70"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-blue-tint/50 text-blue">
                      <MessageSquare className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {t('sendToMessages')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t('sendToMessagesHint')}
                      </span>
                    </span>
                  </button>

                  {canNativeShare ? (
                    <button
                      type="button"
                      disabled={!shareUrl || pending}
                      onClick={() => void handleNativeShare()}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-silver/15 bg-background/40 px-4 py-3 text-start transition hover:border-gold/35 hover:bg-background/70 disabled:opacity-60"
                    >
                      <span className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                        <Share2 className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {t('shareExternally')}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t('shareExternallyHint')}
                        </span>
                      </span>
                    </button>
                  ) : null}

                  <div className="rounded-2xl border border-silver/15 bg-background/30 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
                      {t('copyLink')}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate rounded-xl border border-silver/10 bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
                        {shareUrl ?? t('preparingLink')}
                      </div>
                      <button
                        type="button"
                        disabled={!shareUrl}
                        onClick={() => void handleCopyLink()}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-silver/15 px-3 text-xs font-semibold tracking-[0.12em] text-foreground transition hover:border-gold/35 hover:text-gold disabled:opacity-60"
                      >
                        {copyState === 'copied' ? (
                          <Check className="size-3.5 text-success" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copyState === 'copied'
                          ? t('copied')
                          : copyState === 'error'
                            ? t('copyFailed')
                            : t('copy')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setStep('menu')}
                    className="text-xs font-semibold tracking-[0.14em] text-muted-foreground transition hover:text-gold"
                  >
                    {t('back')}
                  </button>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
                      {t('optionalNote')}
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={400}
                      placeholder={t('optionalNotePlaceholder')}
                      className="w-full resize-none rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                  </label>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
                      {t('pickConversations')}
                    </p>
                    {loadingTargets ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    ) : targets.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-silver/15 px-4 py-6 text-center text-sm text-muted-foreground">
                        {t('noConversations')}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {targets.map((target) => {
                          const isSelected = selected.has(target.id)
                          const result = sendResults.find(
                            (r) => r.targetId === target.id,
                          )
                          return (
                            <li key={target.id}>
                              <button
                                type="button"
                                disabled={!target.canSend || pending}
                                onClick={() => toggleTarget(target)}
                                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start transition disabled:cursor-not-allowed ${
                                  !target.canSend
                                    ? 'border-silver/10 bg-card/20 opacity-80'
                                    : isSelected
                                      ? 'border-gold/40 bg-gold/10'
                                      : 'border-silver/10 bg-card/40 hover:border-silver/25'
                                }`}
                              >
                                {target.kind === 'group' ? (
                                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                                    {target.subtitle.includes('Community') ? (
                                      <Globe2 className="size-4" />
                                    ) : (
                                      <Users className="size-4" />
                                    )}
                                  </span>
                                ) : (
                                  <UserAvatar
                                    name={target.label}
                                    username={target.username}
                                    avatarUrl={target.avatarUrl}
                                    size="sm"
                                    link={false}
                                  />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-foreground">
                                    {target.label}
                                  </span>
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {target.subtitle}
                                  </span>
                                  {!target.canSend && target.blockReason ? (
                                    <span
                                      role="alert"
                                      className="mt-1 block text-[11px] leading-snug text-destructive"
                                    >
                                      {target.blockReason}
                                    </span>
                                  ) : null}
                                  {result && !result.ok ? (
                                    <span
                                      role="alert"
                                      className="mt-1 block text-[11px] leading-snug text-destructive"
                                    >
                                      {result.error}
                                    </span>
                                  ) : null}
                                  {result?.ok ? (
                                    <span className="mt-1 block text-[11px] text-success">
                                      {t('sent')}
                                    </span>
                                  ) : null}
                                </span>
                                <span
                                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? 'border-gold bg-gold text-background'
                                      : 'border-silver/25'
                                  }`}
                                  aria-hidden="true"
                                >
                                  {isSelected ? (
                                    <Check className="size-3" />
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {error ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            {step === 'messages' ? (
              <footer className="border-t border-silver/10 p-4">
                <button
                  type="button"
                  disabled={pending || selected.size === 0}
                  onClick={handleSendToMessages}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-bold tracking-[0.14em] text-black transition hover:bg-gold/90 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4 rtl-flip" />
                  )}
                  {pending
                    ? t('sending')
                    : t('sendCount', { count: selected.size })}
                </button>
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
