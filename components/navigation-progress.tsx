'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { CTA_PRIMARY, CTA_SECONDARY } from '@/lib/accent'
import {
  OFFLINE_SETTLE_MS,
  clearNavigationInFlight,
  isRouteLoading,
  isTourNavigationActive,
  markNavigationIntent,
  notifyNavigationSettled,
  subscribeNavigationIntent,
  subscribeRouteLoading,
  type NavigationOutcome,
  type NavigationSource,
} from '@/lib/navigation-intent'

/** Show a light "loading" cue after this — avoids flicker on fast nav. */
const SHOW_MS = 280
/** Honest "connection is slow" copy while still waiting. */
const SLOW_MS = 4_000
/** Stop waiting forever; offer retry. Soft nav failures often never change the URL. */
const FAIL_MS = 18_000

type Phase = 'idle' | 'pending' | 'slow' | 'failed'

type PendingNavigation = {
  key: string
  href: string
  /** Committed URL when the navigation started — any change means it landed. */
  from: string
  source: NavigationSource
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

/** Same-origin path + search, or null for external / unparsable targets. */
function toKey(href: string): string | null {
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return normalizePathname(url.pathname) + url.search
  } catch {
    return null
  }
}

/** Offline only once it has persisted — flaky links blip offline for a moment. */
function useSettledOffline() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    let timer: number | undefined
    const sync = () => {
      window.clearTimeout(timer)
      if (navigator.onLine) {
        setOffline(false)
        return
      }
      timer = window.setTimeout(() => setOffline(!navigator.onLine), OFFLINE_SETTLE_MS)
    }
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  return offline
}

/**
 * Global navigation progress for slow / flaky connections. Every client
 * navigation reaches it via `onRouterTransitionStart` (instrumentation-client),
 * and full page loads via anchor clicks or Retry. A navigation only clears once
 * the URL has committed and no route loading boundary is still on screen;
 * otherwise it escalates to slow copy and then Retry — never a silent revert.
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  )
}

function NavigationProgressInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  const committed = normalizePathname(pathname ?? '/') + (search ? `?${search}` : '')
  const t = useTranslations('connection')
  const offline = useSettledOffline()

  const [phase, setPhase] = useState<Phase>('idle')
  const [pending, setPending] = useState<PendingNavigation | null>(null)
  const pendingRef = useRef<PendingNavigation | null>(null)
  const committedRef = useRef(committed)
  const timersRef = useRef<{ show?: number; slow?: number; fail?: number }>({})

  const clearTimers = useCallback(() => {
    const timers = timersRef.current
    window.clearTimeout(timers.show)
    window.clearTimeout(timers.slow)
    window.clearTimeout(timers.fail)
    timersRef.current = {}
  }, [])

  const startTimers = useCallback(
    (nav: PendingNavigation, showImmediately: boolean) => {
      clearTimers()
      const still = () => pendingRef.current === nav
      if (showImmediately) setPhase('pending')
      else {
        timersRef.current.show = window.setTimeout(() => {
          if (still()) setPhase('pending')
        }, SHOW_MS)
      }
      timersRef.current.slow = window.setTimeout(() => {
        if (still()) setPhase('slow')
      }, SLOW_MS)
      timersRef.current.fail = window.setTimeout(() => {
        if (still()) setPhase('failed')
      }, FAIL_MS)
    },
    [clearTimers],
  )

  const settle = useCallback(
    (outcome: NavigationOutcome) => {
      const nav = pendingRef.current
      clearTimers()
      pendingRef.current = null
      setPending(null)
      setPhase('idle')
      if (nav) notifyNavigationSettled(outcome, nav.key)
    },
    [clearTimers],
  )

  const checkDone = useCallback(() => {
    const nav = pendingRef.current
    if (!nav || nav.source === 'document') return
    if (committedRef.current === nav.from) return
    if (isRouteLoading()) return
    settle('done')
  }, [settle])

  const begin = useCallback(
    (href: string, source: NavigationSource) => {
      if (source === 'route') return
      // Back/forward must not open the slow-nav card or compete with a push.
      if (source === 'traverse') return
      // Tour owns between-step feedback — don't stack a second loading card.
      if (isTourNavigationActive()) return
      const key = toKey(href)
      if (!key) return
      const from = committedRef.current
      if (key === from && source !== 'document') {
        clearNavigationInFlight()
        return
      }
      if (pendingRef.current?.key === key) return

      const nav: PendingNavigation = { key, href, from, source }
      pendingRef.current = nav
      setPending(nav)
      setPhase('idle')
      startTimers(nav, false)
    },
    [startTimers],
  )

  useEffect(() => {
    committedRef.current = committed
    checkDone()
  }, [committed, checkDone])

  useEffect(() => subscribeNavigationIntent(begin), [begin])

  useEffect(
    () =>
      subscribeRouteLoading((count) => {
        if (count === 0) checkDone()
      }),
    [checkDone],
  )

  useEffect(() => {
    // Plain anchors the router does not handle become full page loads. React
    // listens on `document` first, so a Link's preventDefault is already set.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) {
        return
      }
      const key = toKey(anchor.href)
      if (!key) return
      if (key === committedRef.current && anchor.hash) return
      markNavigationIntent(anchor.href, 'document')
    }
    // Restored from bfcache: the old document's pending navigation is moot.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && pendingRef.current) settle('abandoned')
    }
    document.addEventListener('click', onClick)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [settle])

  useEffect(() => clearTimers, [clearTimers])

  const retry = useCallback(() => {
    const nav = pendingRef.current
    if (!nav) return
    const next: PendingNavigation = { ...nav, source: 'document' }
    pendingRef.current = next
    setPending(next)
    startTimers(next, true)
    markNavigationIntent(nav.href, 'document')
    // Hard navigation is more reliable than soft RSC when the connection is flaky.
    window.location.assign(nav.href)
  }, [startTimers])

  const stay = useCallback(() => {
    settle('abandoned')
  }, [settle])

  if (offline || phase === 'idle' || !pending) return null

  const busy = phase === 'pending' || phase === 'slow'

  return (
    <div
      data-nav-progress={phase}
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <div
        className={`pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)] backdrop-blur-md ${
          phase === 'failed'
            ? 'border-destructive/35 bg-card/95'
            : 'border-gold/30 bg-card/95'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border ${
              phase === 'failed'
                ? 'border-destructive/35 bg-destructive/10 text-destructive'
                : 'border-gold/35 bg-gold/10 text-gold'
            }`}
          >
            {phase === 'failed' ? (
              <WifiOff className="size-4" aria-hidden="true" />
            ) : phase === 'slow' ? (
              <Wifi className="size-4" aria-hidden="true" />
            ) : (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-headline">
              {phase === 'failed'
                ? t('failedTitle')
                : phase === 'slow'
                  ? t('slowTitle')
                  : t('loadingTitle')}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {phase === 'failed'
                ? t('failedBody')
                : phase === 'slow'
                  ? t('slowBody')
                  : t('loadingBody')}
            </p>
            {phase === 'failed' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={retry}
                  className={`${CTA_PRIMARY} inline-flex min-h-10 items-center px-4 text-xs`}
                >
                  {t('retry')}
                </button>
                <button
                  type="button"
                  onClick={stay}
                  className={`${CTA_SECONDARY} inline-flex min-h-10 items-center px-4 text-xs`}
                >
                  {t('stay')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {busy ? (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-silver/15">
            <div
              className={`h-full rounded-full bg-gold transition-all duration-500 ${
                phase === 'slow' ? 'w-4/5 animate-pulse' : 'w-2/5'
              }`}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
