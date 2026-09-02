'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNetworkFailure } from '@/lib/log'
import {
  refreshWorkoutCache,
  resolveSessionUserId,
  revalidateAuthSession,
  setCachedUserId,
} from '@/lib/offline/cache'
import { ensureExerciseLibraryCached } from '@/lib/exercise-library.client'
import {
  hasRecentNavigationIntent,
  markNavigationIntent,
} from '@/lib/navigation-intent'
import { safeRouterRefresh } from '@/lib/safe-router-refresh'
import { countUnsyncedSessions, OFFLINE_CHANGED_EVENT } from '@/lib/offline/session-store'
import { countUnsyncedSplitMutations } from '@/lib/offline/split-store'
import { flushOfflineQueue, retryOfflineQueueNow } from '@/lib/offline/sync'
import { reconcileOutboxWithServer } from '@/lib/offline/reconcile'
import {
  dismissOrphanPurgeNotice,
  getOrphanPurgeNotice,
  purgeStaleOfflineItems,
  type OrphanPurgeNotice,
} from '@/lib/offline/purge-orphans'

type OfflineContextValue = {
  online: boolean
  pendingCount: number
  syncing: boolean
  lastError: string | null
  hydrated: boolean
  orphanNotice: OrphanPurgeNotice | null
  dismissOrphanNotice: () => Promise<void>
  refresh: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

const LAST_PATH_KEY = 'ironstack:return-path'
const IDLE_POLL_MS = 5 * 60_000
const ACTIVE_POLL_MS = 45_000
const FOCUS_DEBOUNCE_MS = 3_000
const CACHE_TTL_MS = 5 * 60_000

function rememberPath(pathname: string) {
  if (!pathname || pathname === '/offline') return
  try {
    sessionStorage.setItem(LAST_PATH_KEY, pathname)
  } catch {
    /* ignore */
  }
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [online, setOnline] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [orphanNotice, setOrphanNotice] = useState<OrphanPurgeNotice | null>(null)
  const lastCacheAt = useRef(0)
  const wasOffline = useRef(false)
  const flushInFlight = useRef(false)
  const pendingCountRef = useRef(0)
  const focusTimer = useRef<number | null>(null)
  const pollDelayRef = useRef(ACTIVE_POLL_MS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    rememberPath(window.location.pathname + window.location.search)
    markNavigationIntent(pathname)
  }, [pathname])

  const refreshCounts = useCallback(async () => {
    try {
      const count =
        (await countUnsyncedSessions()) + (await countUnsyncedSplitMutations())
      pendingCountRef.current = count
      setPendingCount(count)
      pollDelayRef.current = count > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS
    } catch {
      /* IndexedDB may be unavailable */
    }
  }, [])

  const refresh = useCallback(
    async (reason: 'online' | 'poll' | 'manual' | 'reconnect' = 'manual') => {
      if (!isDocumentVisible() && reason === 'poll') return

      await refreshCounts()
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOrphanNotice(await getOrphanPurgeNotice().catch(() => null))
        return
      }

      const isReconnect = reason === 'reconnect'
      const isManual = reason === 'manual'
      const isPoll = reason === 'poll'
      const pending = pendingCountRef.current

      if (isPoll && pending === 0) {
        const cacheStale = Date.now() - lastCacheAt.current > CACHE_TTL_MS
        if (!cacheStale) return
      }

      if (!isPoll) {
        try {
          await reconcileOutboxWithServer()
          await purgeStaleOfflineItems()
          setOrphanNotice(await getOrphanPurgeNotice())
          await refreshCounts()
        } catch {
          /* IndexedDB purge is best-effort */
        }
      }

      const cacheStale = Date.now() - lastCacheAt.current > CACHE_TTL_MS
      const shouldCache = isReconnect || isManual || (isPoll && cacheStale)
      const shouldFlush = pending > 0 || isReconnect || isManual
      const shouldRsc = isReconnect || isManual

      if (!shouldCache && !shouldFlush && !shouldRsc) return

      if (shouldFlush || isReconnect) setSyncing(true)
      setLastError(null)
      try {
        const userId = await revalidateAuthSession()

        if (shouldFlush) {
          if (flushInFlight.current && isPoll) {
            await refreshCounts()
          } else {
            flushInFlight.current = true
            try {
              if (isReconnect || isManual) retryOfflineQueueNow()
              const result = await flushOfflineQueue()
              if (!isPoll) {
                await reconcileOutboxWithServer()
              }
              await refreshCounts()
              const realErrors = result.errors.filter((msg) => !isNetworkFailure(msg))
              setLastError(realErrors[0] ?? null)
            } finally {
              flushInFlight.current = false
            }
          }
        }

        if (shouldCache) {
          let uid = userId
          if (!uid) {
            const supabase = createClient()
            const { data } = await supabase.auth.getSession()
            uid = data.session?.user?.id ?? null
          }
          if (uid) {
            await setCachedUserId(uid)
            await refreshWorkoutCache(uid)
            lastCacheAt.current = Date.now()
          }
        }

        if (shouldRsc) {
          wasOffline.current = false
          if (hasRecentNavigationIntent()) {
            safeRouterRefresh(router, { delayMs: 1_500 })
          } else {
            router.refresh()
          }
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          setLastError(err instanceof Error ? err.message : 'Sync failed')
        }
      } finally {
        setSyncing(false)
      }
    },
    [refreshCounts, router],
  )

  useEffect(() => {
    setHydrated(true)
    setOnline(navigator.onLine)
    void resolveSessionUserId()
    void refreshCounts()

    const scheduleSync = (reason: 'poll' | 'reconnect') => {
      if (!isDocumentVisible() && reason === 'poll') return
      if (focusTimer.current) window.clearTimeout(focusTimer.current)
      focusTimer.current = window.setTimeout(() => {
        focusTimer.current = null
        if (!navigator.onLine) return
        void refresh(wasOffline.current ? 'reconnect' : reason).finally(() => {
          setOnline(navigator.onLine)
        })
      }, reason === 'poll' ? 0 : FOCUS_DEBOUNCE_MS)
    }

    const onOnline = () => {
      void refresh('reconnect').finally(() => {
        setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
      })
    }
    const onOffline = () => {
      wasOffline.current = true
      setOnline(false)
    }
    const onChanged = () => {
      void refreshCounts()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        rememberPath(window.location.pathname + window.location.search)
        scheduleSync(wasOffline.current ? 'reconnect' : 'poll')
      }
    }

    const onPageShow = () => scheduleSync('poll')
    const onWindowFocus = () => scheduleSync('poll')

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(OFFLINE_CHANGED_EVENT, onChanged)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisible)

    void refresh('online')

    const deferCatalog = () => {
      if (navigator.onLine) void ensureExerciseLibraryCached()
    }
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(deferCatalog, { timeout: 8000 })
    } else {
      window.setTimeout(deferCatalog, 2000)
    }

    let pollTimer: number | null = null
    const schedulePoll = () => {
      if (pollTimer) window.clearTimeout(pollTimer)
      pollTimer = window.setTimeout(() => {
        pollTimer = null
        const next = navigator.onLine
        if (!next) {
          setOnline(false)
          void refreshCounts()
        } else if (isDocumentVisible()) {
          void refresh(wasOffline.current ? 'reconnect' : 'poll').finally(() => {
            setOnline(navigator.onLine)
          })
        }
        schedulePoll()
      }, pollDelayRef.current)
    }
    schedulePoll()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(OFFLINE_CHANGED_EVENT, onChanged)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisible)
      if (focusTimer.current) window.clearTimeout(focusTimer.current)
      if (pollTimer) window.clearTimeout(pollTimer)
    }
  }, [refresh, refreshCounts])

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      syncing,
      lastError,
      hydrated,
      orphanNotice,
      dismissOrphanNotice: async () => {
        await dismissOrphanPurgeNotice()
        setOrphanNotice(null)
      },
      refresh: () => {
        retryOfflineQueueNow()
        return refresh('manual')
      },
    }),
    [online, pendingCount, syncing, lastError, hydrated, orphanNotice, refresh],
  )

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  )
}

export function useOfflineStatus() {
  const ctx = useContext(OfflineContext)
  return (
    ctx ?? {
      online: true,
      pendingCount: 0,
      syncing: false,
      lastError: null,
      hydrated: false,
      orphanNotice: null,
      dismissOrphanNotice: async () => {},
      refresh: async () => {},
    }
  )
}
