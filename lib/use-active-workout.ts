'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

export function useActiveWorkout() {
  const [active, setActive] = useState<ActiveWorkoutView | null>(null)
  const [ready, setReady] = useState(false)
  const refreshGen = useRef(0)

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
    const onChange = () => {
      void refresh()
    }
    window.addEventListener(OFFLINE_CHANGED_EVENT, onChange)
    window.addEventListener('focus', onChange)
    return () => {
      window.removeEventListener(OFFLINE_CHANGED_EVENT, onChange)
      window.removeEventListener('focus', onChange)
    }
  }, [refresh])

  return { active, ready, refresh }
}
