import type { ActiveSessionProgress, LocalSession } from '@/lib/offline/db'

export const UNFINISHED_SESSION_PREF_KEY = 'ironstack.unfinished-session-alerts'

export type ActiveWorkoutView = {
  id: string
  splitId: string
  splitDayId: string
  startedAt: string
  splitName: string
  dayName: string
  exerciseIndex: number
  totalExercises: number
  setsLogged: number
  href: string
}

export function viewFromLocalSession(session: LocalSession): ActiveWorkoutView {
  const progress = session.progress
  return {
    id: session.id,
    splitId: session.splitId,
    splitDayId: session.splitDayId,
    startedAt: session.startedAt,
    splitName: progress?.splitName || 'Workout',
    dayName: progress?.dayName || 'In progress',
    exerciseIndex: progress?.exerciseIndex ?? 0,
    totalExercises: progress?.totalExercises ?? 0,
    setsLogged: session.logs.filter((log) => !log.isSkipped).length,
    href: `/dashboard/splits/${session.splitId}/session`,
  }
}

export function buildProgressPayload(input: {
  splitName: string
  dayIndex: number
  dayId: string
  dayName: string
  exerciseIndex: number
  totalExercises: number
  stage: ActiveSessionProgress['stage']
  loggedExercises: ActiveSessionProgress['loggedExercises']
  currentEntries: ActiveSessionProgress['currentEntries']
  reminderSent?: boolean
}): ActiveSessionProgress {
  return {
    splitName: input.splitName,
    dayIndex: input.dayIndex,
    dayId: input.dayId,
    dayName: input.dayName,
    exerciseIndex: input.exerciseIndex,
    totalExercises: input.totalExercises,
    stage: input.stage,
    loggedExercises: input.loggedExercises,
    currentEntries: input.currentEntries,
    reminderSent: input.reminderSent,
  }
}

export function unfinishedAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(UNFINISHED_SESSION_PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function setUnfinishedAlertsEnabled(on: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(UNFINISHED_SESSION_PREF_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function clearUnfinishedWorkoutReminder() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  try {
    void navigator.serviceWorker?.ready.then((reg) => {
      const getNotifications = reg.getNotifications?.bind(reg)
      if (!getNotifications) return
      void getNotifications({ tag: 'ironstack-active-session' }).then((list) => {
        for (const notification of list) notification.close()
      })
    })
  } catch {
    /* ignore */
  }
}

export function notifyUnfinishedWorkout() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  if (!unfinishedAlertsEnabled()) return
  try {
    new Notification('IronStack', {
      body: 'You have an unfinished workout.',
      tag: 'ironstack-active-session',
      silent: false,
    })
  } catch {
    /* unsupported payload on this browser */
  }
}
