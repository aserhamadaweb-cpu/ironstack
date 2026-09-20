'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EASE } from '@/components/reveal'

export type ActionFeedbackKind = 'success' | 'error' | 'info'

type ToastState = {
  id: number
  kind: ActionFeedbackKind
  message: string
}

type ActionFeedbackApi = {
  notify: (kind: ActionFeedbackKind, message: string) => void
  notifySuccess: (message: string) => void
  notifyError: (message: string) => void
}

const ActionFeedbackContext = createContext<ActionFeedbackApi | null>(null)

let toastId = 0

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [mounted, setMounted] = useState(false)
  const reduce = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const notify = useCallback(
    (kind: ActionFeedbackKind, message: string) => {
      const text = message.trim()
      if (!text) return
      clearTimer()
      const id = ++toastId
      setToast({ id, kind, message: text })
      timerRef.current = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current))
      }, kind === 'error' ? 6000 : 3500)
    },
    [clearTimer],
  )

  const notifySuccess = useCallback(
    (message: string) => notify('success', message),
    [notify],
  )
  const notifyError = useCallback(
    (message: string) => notify('error', message),
    [notify],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const api: ActionFeedbackApi = {
    notify,
    notifySuccess,
    notifyError,
  }

  return (
    <ActionFeedbackContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.id}
                  role={toast.kind === 'error' ? 'alert' : 'status'}
                  aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className={`fixed inset-x-3 z-[70] mx-auto flex max-w-md items-start gap-2.5 rounded-2xl border p-3 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.75)] backdrop-blur bottom-[calc(var(--app-tabbar-clearance,4.25rem)+0.75rem)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 ${
                    toast.kind === 'error'
                      ? 'border-destructive/35 bg-card/95 text-destructive'
                      : toast.kind === 'success'
                        ? 'border-gold/40 bg-card/95 text-gold'
                        : 'border-silver/25 bg-card/95 text-foreground'
                  }`}
                >
                  {toast.kind === 'error' ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                  )}
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {toast.message}
                  </p>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    aria-label="Dismiss"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </ActionFeedbackContext.Provider>
  )
}

export function useActionFeedback(): ActionFeedbackApi {
  const ctx = useContext(ActionFeedbackContext)
  if (!ctx) {
    return {
      notify: () => {},
      notifySuccess: () => {},
      notifyError: () => {},
    }
  }
  return ctx
}

/**
 * Inline success/error under an action button. Scrolls into view when shown
 * so the athlete never has to hunt at the top of a long page.
 */
export function ActionFeedbackBanner({
  error,
  success,
  className = '',
  onRetry,
  retryLabel,
}: {
  error?: string | null
  success?: string | null
  className?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const message = error || success || null
  const isError = Boolean(error)

  useEffect(() => {
    if (!message || !ref.current) return
    ref.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [message])

  if (!message) return null

  return (
    <div
      ref={ref}
      id={headingId}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-3 text-sm ${
        isError
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-gold/35 bg-gold-tint text-gold'
      } ${className}`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className={isError ? 'text-destructive' : 'text-foreground'}>{message}</p>
        {isError && onRetry ? (
          <button
            type="button"
            className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
            onClick={onRetry}
          >
            {retryLabel ?? 'Retry'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
