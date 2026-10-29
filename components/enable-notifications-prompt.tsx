'use client'

import { useEffect, useId, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { savePushSubscriptionAction } from '@/lib/data/notification-actions'
import { useActiveWorkout } from '@/lib/use-active-workout'
import { useAppTour } from '@/components/app-tour/app-tour-provider'
import {
  pushSupported,
  subscribeToPush,
  subscriptionKeys,
} from '@/lib/push/client'

const STORAGE_KEY = 'ironstack:push-prompt'
/** A new account still counts as a first open for two days. */
const FIRST_OPEN_MS = 48 * 60 * 60 * 1000

function isFirstOpen(createdAt: string | null) {
  if (!createdAt) return false
  const at = new Date(createdAt).getTime()
  return Number.isFinite(at) && Date.now() - at < FIRST_OPEN_MS
}

function alreadyAnswered() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberAnswer() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* private mode — the prompt may return next visit */
  }
}

type EnableNotificationsPromptProps = {
  createdAt: string | null
}

/**
 * One message, the first time a new account opens the app, asking to turn
 * phone notifications on. Not now and a successful enable both dismiss it.
 */
export function EnableNotificationsPrompt({
  createdAt,
}: EnableNotificationsPromptProps) {
  const t = useTranslations('pushPrompt')
  const pathname = usePathname()
  const titleId = useId()
  const { active, ready: workoutReady } = useActiveWorkout()
  const { isTourVisible } = useAppTour()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const inSession = /\/splits\/[^/]+\/session(?:\/|$)/.test(pathname)

  useEffect(() => {
    if (!workoutReady || active || isTourVisible || inSession) return
    if (!isFirstOpen(createdAt) || alreadyAnswered()) return
    if (!pushSupported() || Notification.permission !== 'default') return
    const timer = window.setTimeout(() => setOpen(true), 700)
    return () => window.clearTimeout(timer)
  }, [active, createdAt, inSession, isTourVisible, workoutReady])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        rememberAnswer()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const dismiss = () => {
    rememberAnswer()
    setOpen(false)
  }

  const enable = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setMessage(t('denied'))
          rememberAnswer()
          return
        }
        const sub = await subscribeToPush()
        const saved = await savePushSubscriptionAction(subscriptionKeys(sub))
        if (!saved.ok) {
          setMessage(saved.error ?? t('failed'))
          return
        }
        rememberAnswer()
        setOpen(false)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : t('failed'))
      }
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:items-center sm:pb-6">
      <button
        type="button"
        aria-label={t('notNow')}
        className="absolute inset-0 bg-background/70"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="is-panel relative w-full max-w-sm p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
      >
        <span className="flex size-11 items-center justify-center rounded-full border border-silver/20 bg-card text-gold">
          <Bell className="size-5" aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-4 font-heading text-xl font-bold text-foreground">
          {t('title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('body')}</p>
        {message && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {message}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={pending}
            autoFocus
            className="btn-pill btn-pill-primary inline-flex min-h-11 items-center justify-center gap-2"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t('enable')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="btn-pill btn-pill-secondary min-h-11"
          >
            {t('notNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
