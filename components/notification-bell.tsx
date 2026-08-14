'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, CheckCheck, Loader2 } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  savePushSubscriptionAction,
} from '@/lib/data/notification-actions'
import type { NotificationListItem } from '@/lib/data/notifications'
import {
  pushSupported,
  subscribeToPush,
  subscriptionKeys,
} from '@/lib/push/client'

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

export function NotificationBell() {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationListItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pushStatus, setPushStatus] = useState<
    'idle' | 'unsupported' | 'denied' | 'enabled' | 'error'
  >('idle')
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getNotificationsAction()
      setItems(result.notifications)
      setUnreadCount(result.unreadCount)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!pushSupported()) {
      setPushStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev
      if (next) void refresh()
      return next
    })
  }

  const onItemClick = (item: NotificationListItem) => {
    startTransition(async () => {
      if (!item.is_read) {
        await markNotificationReadAction(item.id)
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      }
      setOpen(false)
      if (item.link) router.push(item.link)
    })
  }

  const markAllRead = () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction()
      if (!result.ok) return
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    })
  }

  const enablePush = () => {
    setPushMessage(null)
    startTransition(async () => {
      try {
        if (!pushSupported()) {
          setPushStatus('unsupported')
          return
        }
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setPushStatus('denied')
          setPushMessage('Notifications blocked in browser settings.')
          return
        }
        const sub = await subscribeToPush()
        const keys = subscriptionKeys(sub)
        const saved = await savePushSubscriptionAction(keys)
        if (!saved.ok) {
          setPushStatus('error')
          setPushMessage(saved.error ?? 'Could not save subscription.')
          return
        }
        setPushStatus('enabled')
        setPushMessage('Browser notifications enabled.')
      } catch (err) {
        setPushStatus('error')
        setPushMessage(
          err instanceof Error ? err.message : 'Could not enable push.',
        )
      }
    })
  }

  const badge =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={
          badge
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex size-10 items-center justify-center rounded-lg border border-silver/15 text-muted-foreground transition-colors active:opacity-70 sm:size-11"
      >
        <Bell className="size-4" aria-hidden="true" />
        {badge && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-background">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          className="fixed inset-x-3 z-[70] mt-2 flex max-h-[min(70dvh,28rem)] flex-col overflow-hidden rounded-2xl border border-silver/15 bg-background shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] top-[calc(env(safe-area-inset-top)+3.25rem)] sm:absolute sm:inset-x-auto sm:end-0 sm:top-auto sm:mt-2 sm:w-[min(22rem,calc(100vw-1.5rem))]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-silver/10 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-[0.28em] text-gold">
              NOTIFICATIONS
            </p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={pending || unreadCount === 0}
              className="inline-flex min-h-11 items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground transition active:text-gold disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              MARK ALL READ
            </button>
          </div>

          <div className="max-h-[min(24rem,55vh)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-silver/10">
                {items.map((item) => {
                  const relatedName =
                    item.related?.display_name ||
                    item.related?.username ||
                    'Athlete'
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onItemClick(item)}
                        className={`flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left transition active:bg-card/80 ${
                          item.is_read ? 'opacity-70' : 'bg-gold/[0.06]'
                        }`}
                      >
                        {item.related ? (
                          <UserAvatar
                            name={relatedName}
                            username={item.related.username}
                            userId={item.related.id}
                            avatarUrl={item.related.avatar_url}
                            size="sm"
                            link={false}
                            className="!size-9 !text-[10px]"
                          />
                        ) : (
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-silver/20 bg-card">
                            <Bell className="size-3.5 text-gold" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-heading text-sm font-semibold text-foreground">
                              {item.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                              {relativeTime(item.created_at)}
                              {!item.is_read && (
                                <span
                                  className="size-1.5 rounded-full bg-gold"
                                  aria-label="Unread"
                                />
                              )}
                            </span>
                          </span>
                          {item.body && (
                            <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {item.body}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-silver/10 px-4 py-3">
            {pushStatus === 'unsupported' ? (
              <p className="text-xs text-muted-foreground">
                Push notifications aren&apos;t supported in this browser.
              </p>
            ) : pushStatus === 'enabled' ? (
              <p className="text-xs text-gold">
                {pushMessage ?? 'Browser notifications enabled.'}
              </p>
            ) : (
              <button
                type="button"
                onClick={enablePush}
                disabled={pending || pushStatus === 'denied'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-silver/15 px-3 py-2.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BellOff className="size-3.5" aria-hidden="true" />
                )}
                {pushStatus === 'denied'
                  ? 'PUSH BLOCKED IN BROWSER'
                  : 'ENABLE BROWSER NOTIFICATIONS'}
              </button>
            )}
            {pushMessage && pushStatus !== 'enabled' && (
              <p className="mt-2 text-xs text-destructive">{pushMessage}</p>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Or open{' '}
              <Link
                href="/dashboard/notifications"
                className="text-muted-foreground underline-offset-2 hover:text-gold hover:underline"
                onClick={() => setOpen(false)}
              >
                notification settings
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
