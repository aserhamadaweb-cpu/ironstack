'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from '@/lib/data/notification-actions'
import {
  pushSupported,
  registerPushServiceWorker,
  subscribeToPush,
  subscriptionKeys,
} from '@/lib/push/client'

type NotificationSettingsProps = {
  /** Hide the page-style header when embedded in Settings. */
  embedded?: boolean
}

export function NotificationSettings({
  embedded = false,
}: NotificationSettingsProps) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    'checking' | 'unsupported' | 'off' | 'on' | 'denied'
  >('checking')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!pushSupported()) {
        if (!cancelled) setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied')
        return
      }
      try {
        const reg = await registerPushServiceWorker()
        await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setStatus(sub ? 'on' : 'off')
      } catch {
        if (!cancelled) setStatus('off')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setStatus('denied')
          setMessage('Permission denied in browser settings.')
          return
        }
        const sub = await subscribeToPush()
        const keys = subscriptionKeys(sub)
        const saved = await savePushSubscriptionAction(keys)
        if (!saved.ok) {
          setMessage(saved.error ?? 'Could not save subscription.')
          return
        }
        setStatus('on')
        setMessage('Browser notifications enabled for this device.')
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : 'Could not enable notifications.',
        )
      }
    })
  }

  const disable = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
        }
        // Clear all rows for this user (all devices that shared this account).
        await removePushSubscriptionAction()
        setStatus('off')
        setMessage('Browser notifications turned off.')
      } catch (err) {
        setMessage(
          err instanceof Error
            ? err.message
            : 'Could not disable notifications.',
        )
      }
    })
  }

  return (
    <section className="space-y-6">
      {!embedded && (
        <header>
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
            SETTINGS
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            In-app alerts show in the bell menu. Optionally enable browser push
            so you get alerts when IronStack is in the background.
          </p>
        </header>
      )}

      <div className="is-panel p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-silver/20 bg-card text-gold">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Browser push
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Follows, messages, friends, PRs, and shared-split saves can notify
              this device.
            </p>

            {status === 'checking' && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Checking…
              </p>
            )}
            {status === 'unsupported' && (
              <p className="mt-4 text-sm text-muted-foreground">
                This browser doesn&apos;t support push notifications.
              </p>
            )}
            {status === 'denied' && (
              <p className="mt-4 text-sm text-destructive">
                Permission blocked. Enable notifications for this site in your
                browser settings, then try again.
              </p>
            )}
            {(status === 'off' || status === 'on') && (
              <button
                type="button"
                onClick={status === 'on' ? disable : enable}
                disabled={pending}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-silver/15 px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : status === 'on' ? (
                  <BellOff className="size-3.5" />
                ) : (
                  <Bell className="size-3.5" />
                )}
                {status === 'on' ? 'DISABLE ON THIS DEVICE' : 'ENABLE PUSH'}
              </button>
            )}
            {message && (
              <p className="mt-3 text-xs text-muted-foreground">{message}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
