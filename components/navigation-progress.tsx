'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { CTA_PRIMARY, CTA_SECONDARY } from '@/lib/accent'
import {
  markNavigationIntent,
  subscribeNavigationIntent,
} from '@/lib/navigation-intent'
import { useOfflineStatus } from '@/lib/offline/provider'

/** Show a light "loading" cue after this — avoids flicker on fast nav. */
const SHOW_MS = 280
/** Honest "connection is slow" copy while still waiting. */
const SLOW_MS = 4_000
/** Stop waiting forever; offer retry. Soft nav failures often never change pathname. */
const FAIL_MS = 18_000

type Phase = 'idle' | 'pending' | 'slow' | 'failed'

function normalizePath(path: string) {
  const bare = path.split('#')[0]?.split('?')[0] ?? path
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1)
  return bare || '/'
}

function pathsMatch(current: string, target: string) {
  const a = normalizePath(current)
  const b = normalizePath(target)
  return a === b || a.startsWith(`${b}/`)
}

/**
 * Global soft-navigation progress for flaky/slow connections.
 * Distinct from fully-offline floor pages: only when navigator reports online
 * (or unknown) and a client navigation is taking too long or never completes.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const t = useTranslations('connection')
  const { online, hydrated } = useOfflineStatus()
  const fullyOffline = hydrated && !online

  const [phase, setPhase] = useState<Phase>('idle')
  const [target, setTarget] = useState<string | null>(null)
  const targetRef = useRef<string | null>(null)
  const timersRef = useRef<{ show?: number; slow?: number; fail?: number }>({})

  const clearTimers = useCallback(() => {
    const timers = timersRef.current
    if (timers.show) window.clearTimeout(timers.show)
    if (timers.slow) window.clearTimeout(timers.slow)
    if (timers.fail) window.clearTimeout(timers.fail)
    timersRef.current = {}
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    targetRef.current = null
    setTarget(null)
    setPhase('idle')
  }, [clearTimers])

  const begin = useCallback(
    (href: string) => {
      if (fullyOffline) return
      const next = normalizePath(href)
      if (!next.startsWith('/')) return
      if (pathsMatch(pathname, next)) return

      clearTimers()
      targetRef.current = next
      setTarget(next)
      setPhase('idle')

      timersRef.current.show = window.setTimeout(() => {
        if (targetRef.current === next) setPhase('pending')
      }, SHOW_MS)
      timersRef.current.slow = window.setTimeout(() => {
        if (targetRef.current === next) setPhase('slow')
      }, SLOW_MS)
      timersRef.current.fail = window.setTimeout(() => {
        if (targetRef.current === next) setPhase('failed')
      }, FAIL_MS)
    },
    [clearTimers, fullyOffline, pathname],
  )

  useEffect(() => {
    return subscribeNavigationIntent((path) => begin(path))
  }, [begin])

  useEffect(() => {
    const pending = targetRef.current
    if (!pending) return
    if (pathsMatch(pathname, pending)) reset()
  }, [pathname, reset])

  useEffect(() => {
    if (fullyOffline) reset()
  }, [fullyOffline, reset])

  const retry = useCallback(() => {
    const href = targetRef.current
    if (!href) return
    markNavigationIntent(href)
    setPhase('pending')
    clearTimers()
    timersRef.current.slow = window.setTimeout(() => {
      if (targetRef.current === href) setPhase('slow')
    }, SLOW_MS)
    timersRef.current.fail = window.setTimeout(() => {
      if (targetRef.current === href) setPhase('failed')
    }, FAIL_MS)
    // Hard navigation is more reliable than soft RSC when the connection is flaky.
    window.location.assign(href)
  }, [clearTimers])

  const stay = useCallback(() => {
    reset()
  }, [reset])

  if (fullyOffline || phase === 'idle' || !target) return null

  const busy = phase === 'pending' || phase === 'slow'

  return (
    <div
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
