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
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNetworkFailure } from '@/lib/log'
import {
  refreshWorkoutCache,
  resolveSessionUserId,
  revalidateAuthSession,
  setCachedUserId,
} from '@/lib/offline/cache'
import { ensureExerciseLibraryCached } from '@/lib/exercise-library.client'
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

function rememberPath(pathname: string) {
  if (!pathname || pathname === '/offline') return
  try {
    sessionStorage.setItem(LAST_PATH_KEY, pathname)
  } catch {
    /* ignore */
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [online, setOnline] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [orphanNotice, setOrphanNotice] = useState<OrphanPurgeNotice | null>(null)
  const lastCacheAt = useRef(0)
  const wasOffline = useRef(false)
  const flushInFlight = useRef(false)

  const refreshCounts = useCallback(async () => {
    try {
      setPendingCount(
        (await countUnsyncedSessions()) + (await countUnsyncedSplitMutations()),
      )
    } catch {
      /* IndexedDB may be unavailable */
    }
  }, [])

  const refresh = useCallback(
    async (reason: 'online' | 'poll' | 'manual' | 'reconnect' = 'manual') => {
      await refreshCounts()
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOrphanNotice(await getOrphanPurgeNotice().catch(() => null))
        return
      }

      try {
        await reconcileOutboxWithServer()
        await purgeStaleOfflineItems()
        setOrphanNotice(await getOrphanPurgeNotice())
        await refreshCounts()
      } catch {
        /* IndexedDB purge is best-effort */
      }

      const cacheStale = Date.now() - lastCacheAt.current > 5 * 60_000
      const isReconnect = reason === 'reconnect'
      const shouldCache = isReconnect || reason !== 'poll' || cacheStale
      let pending = 0
      try {
        pending =
          (await countUnsyncedSessions()) +
          (await countUnsyncedSplitMutations())
      } catch {
        pending = 0
      }
      const shouldFlush = pending > 0 || isReconnect || reason === 'manual'
      const shouldRsc = isReconnect || reason === 'manual'

      if (!shouldCache && !shouldFlush && !shouldRsc) return

      if (shouldFlush || isReconnect) setSyncing(true)
      setLastError(null)
      try {
        const userId = await revalidateAuthSession()

        if (shouldFlush) {
          if (flushInFlight.current && reason === 'poll') {
            await refreshCounts()
          } else {
            flushInFlight.current = true
            try {
              if (isReconnect || reason === 'manual') retryOfflineQueueNow()
              const result = await flushOfflineQueue()
              await reconcileOutboxWithServer()
              await refreshCounts()
              const realErrors = result.errors.filter((msg) => !isNetworkFailure(msg))
              setLastError(realErrors[0] ?? null)
              if (result.synced > 0 && !shouldRsc) router.refresh()
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
            await ensureExerciseLibraryCached()
            lastCacheAt.current = Date.now()
          }
        }

        if (shouldRsc) {
          wasOffline.current = false
          router.refresh()
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
    const syncIfOnline = () => {
      if (!navigator.onLine) return
      if (wasOffline.current) {
        void refresh('reconnect').finally(() => {
          setOnline(navigator.onLine)
        })
        return
      }
      void refresh('poll')
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        rememberPath(window.location.pathname + window.location.search)
        syncIfOnline()
      }
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(OFFLINE_CHANGED_EVENT, onChanged)
    window.addEventListener('pageshow', syncIfOnline)
    window.addEventListener('focus', syncIfOnline)
    document.addEventListener('visibilitychange', onVisible)
    void refresh('online')
    if (navigator.onLine) void ensureExerciseLibraryCached()
    const poll = window.setInterval(() => {
      const next = navigator.onLine
      if (!next) {
        setOnline(false)
        void refreshCounts()
        return
      }
      void refresh(wasOffline.current ? 'reconnect' : 'poll').finally(() => {
        setOnline(navigator.onLine)
      })
    }, 30_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(OFFLINE_CHANGED_EVENT, onChanged)
      window.removeEventListener('pageshow', syncIfOnline)
      window.removeEventListener('focus', syncIfOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
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
