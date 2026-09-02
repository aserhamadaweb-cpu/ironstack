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
      const local = await getActiveLocalSession()
      if (gen !== refreshGen.current) return
      if (local) {
        setActive(viewFromLocalSession(local))
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
    window.addEventListener(OFFLINE_CHANGED_EVENT, onChange)
    window.addEventListener('focus', scheduleRefresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    })
    return () => {
      window.removeEventListener(OFFLINE_CHANGED_EVENT, onChange)
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

  throw new Error('useActiveWorkout must be used within ActiveWorkoutProvider')
}
