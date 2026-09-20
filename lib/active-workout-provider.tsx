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
import { getActiveSessionAction } from '@/lib/data/session-actions'
import {
  viewFromLocalSession,
  type ActiveWorkoutView,
} from '@/lib/active-workout'
import { resolveSessionUserId } from '@/lib/offline/cache'
import {
  getActiveLocalSession,
  getLocalSession,
  OFFLINE_CHANGED_EVENT,
} from '@/lib/offline/session-store'

type ActiveWorkoutContextValue = {
  active: ActiveWorkoutView | null
  ready: boolean
  refresh: () => Promise<void>
}

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null)

function ActiveWorkoutProviderInner({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveWorkoutView | null>(null)
  const [ready, setReady] = useState(false)
  const refreshGen = useRef(0)
  const focusTimer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    const gen = ++refreshGen.current
    try {
      const userId = await resolveSessionUserId().catch(() => null)
      const local = await getActiveLocalSession(userId)
      if (gen !== refreshGen.current) return
      if (local) {
        setActive(viewFromLocalSession(local))
        setReady(true)
        return
      }
      // Offline: never fall back to a server in_progress row. Zombie shells
      // from partial sync would look like a live workout (and trip the tour
      // "finish your workout first" prompt) when nothing is actually active.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setActive(null)
        setReady(true)
        return
      }
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const remote = await getActiveSessionAction()
        if (gen !== refreshGen.current) return
        if (remote.data) {
          const localForRemote = await getLocalSession(remote.data.id)
          if (gen !== refreshGen.current) return
          if (localForRemote && localForRemote.status !== 'in_progress') {
            // Local already finished/cancelled — do not advertise the zombie
            // in_progress server row. Kick sync so finish can land.
            if (
              localForRemote.status === 'completed' &&
              localForRemote.syncStatus !== 'synced'
            ) {
              void import('@/lib/offline/sync').then(({ queueSessionSync }) => {
                queueSessionSync(localForRemote)
              })
            }
            setActive(null)
            setReady(true)
            return
          }
          setActive({
            id: remote.data.id,
            splitId: remote.data.splitId,
            splitDayId: remote.data.splitDayId,
            startedAt: remote.data.startedAt,
            splitName: remote.data.splitName || 'Workout',
            dayName: remote.data.dayName || 'In progress',
            exerciseIndex: 0,
            totalExercises: 0,
            setsLogged: 0,
            href: `/dashboard/splits/${remote.data.splitId}/session`,
          })
          setReady(true)
          return
        }
      }
      if (gen !== refreshGen.current) return
      setActive(null)
    } catch {
      if (gen !== refreshGen.current) return
      setActive(null)
    } finally {
      if (gen === refreshGen.current) setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const scheduleRefresh = () => {
      if (focusTimer.current) window.clearTimeout(focusTimer.current)
      focusTimer.current = window.setTimeout(() => {
        focusTimer.current = null
        if (document.visibilityState !== 'visible') return
        void refresh()
      }, 2500)
    }
    const onChange = () => {
      void refresh()
    }
    const onOnline = () => {
      // Prefer local in-progress immediately; remote is only a fallback inside refresh.
      void refresh()
    }
    window.addEventListener(OFFLINE_CHANGED_EVENT, onChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onChange)
    window.addEventListener('focus', scheduleRefresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    })
    return () => {
      window.removeEventListener(OFFLINE_CHANGED_EVENT, onChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onChange)
      window.removeEventListener('focus', scheduleRefresh)
      if (focusTimer.current) window.clearTimeout(focusTimer.current)
    }
  }, [refresh])

  const value = useMemo(
    () => ({ active, ready, refresh }),
    [active, ready, refresh],
  )

  return (
    <ActiveWorkoutContext.Provider value={value}>
      {children}
    </ActiveWorkoutContext.Provider>
  )
}

export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  return <ActiveWorkoutProviderInner>{children}</ActiveWorkoutProviderInner>
}

export function useActiveWorkout() {
  const ctx = useContext(ActiveWorkoutContext)
  if (ctx) return ctx

  // Safe fallback for shells that mount banner before provider (should be rare).
  return {
    active: null,
    ready: false,
    refresh: async () => undefined,
  }
}
