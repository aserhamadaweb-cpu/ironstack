/**
 * Client-side logged-session store (localStorage-backed).
 *
 * This is the single data structure behind the Active Session flow, the
 * "Last Session Summary" / history / journey volume on the Workout page,
 * and the "Recent Activity" streak tiles on Home — saving a session here
 * reflects everywhere immediately on next render.
 */

export type LoggedSet = {
  setNumber: number
  weight: number
  reps: number
  /** false = the set was unchecked when the exercise was finished (skipped). */
  completed: boolean
}

export type LoggedExercise = {
  name: string
  muscle: string
  image?: string
  targetSets: number
  targetReps: string
  sets: LoggedSet[]
}

export type SessionPr = {
  exercise: string
  weight: number
  reps: number
  /** Previous best weight beaten, or null when this session set the baseline. */
  previousBest: number | null
}

export type LoggedSession = {
  id: string
  splitSlug: string
  splitName: string
  dayFocus: string
  /** ISO datetime of session start. */
  startedAt: string
  durationSec: number
  /** Sum of weight × reps across completed (non-skipped) sets only. */
  volumeKg: number
  setsCompleted: number
  setsSkipped: number
  exercises: LoggedExercise[]
  prs: SessionPr[]
}

const STORAGE_KEY = 'ironstack.sessions.v1'

/** All logged sessions, oldest first. Safe to call anywhere (returns [] on server). */
export function loadSessions(): LoggedSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as LoggedSession[]) : []
  } catch {
    return []
  }
}

export function saveSession(session: LoggedSession) {
  const sessions = loadSessions()
  sessions.push(session)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Storage unavailable/full — the session simply won't persist.
  }
}

export type PreviousBest = { weight: number; reps: number }

/**
 * Heaviest weight ever completed for an exact exercise name, across every
 * stored session and set number, with the reps done at that weight.
 */
export function getPreviousBest(
  sessions: LoggedSession[],
  exerciseName: string
): PreviousBest | null {
  let best: PreviousBest | null = null
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.name !== exerciseName) continue
      for (const set of exercise.sets) {
        if (!set.completed || set.weight <= 0) continue
        if (!best || set.weight > best.weight) {
          best = { weight: set.weight, reps: set.reps }
        }
      }
    }
  }
  return best
}

/** Running-timer / duration display: "mm:ss", or "h:mm:ss" past an hour. */
export function formatClock(totalSec: number) {
  const safe = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Human duration for history rows, e.g. "48m" / "1h 12m". */
export function formatDuration(totalSec: number) {
  const safe = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${safe}s`
}

/** Compact volume label. Stored kg; pass preferred unit for display. */
export function formatVolume(kg: number, unit: 'kg' | 'lb' = 'kg') {
  if (!Number.isFinite(kg) || kg <= 0) return `0 ${unit}`
  const display = unit === 'lb' ? kg * 2.2046226218 : kg
  if (display >= 1000) {
    return `${(Math.round(display / 100) / 10).toLocaleString()}k ${unit}`
  }
  return `${Math.round(display).toLocaleString()} ${unit}`
}

/** Short date label like "Jul 26". */
export function formatSessionDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(iso)
  )
}

/** True when both dates fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Relative finished_at badge for Last Session Summary
 * ("Today", "Yesterday", "2 days ago", or a short date).
 * Pass locale so Arabic mode gets natural phrasing (avoids RTL bidi on English).
 * Latin date fallbacks are unicode-isolated so they keep LTR order in RTL pages.
 */
export function formatRelativeFinishedAt(
  iso: string | null | undefined,
  locale: 'en' | 'ar' = 'en',
) {
  const ar = locale === 'ar'
  if (!iso) return ar ? 'حديث' : 'Recent'
  const finished = new Date(iso)
  if (Number.isNaN(finished.getTime())) return ar ? 'حديث' : 'Recent'

  const now = new Date()
  if (isSameLocalDay(finished, now)) return ar ? 'اليوم' : 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameLocalDay(finished, yesterday)) return ar ? 'أمس' : 'Yesterday'

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfFinished = new Date(
    finished.getFullYear(),
    finished.getMonth(),
    finished.getDate(),
  )
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfFinished.getTime()) / (24 * 60 * 60 * 1000),
  )
  if (dayDiff > 1 && dayDiff < 14) {
    // Arabic phrase keeps correct order in RTL; English embeds LTR isolate
    // so "5 days ago" never becomes "days ago 5" inside an RTL container.
    return ar
      ? `منذ ${dayDiff} أيام`
      : `\u2066${dayDiff} days ago\u2069`
  }

  const date = formatSessionDate(iso)
  return ar ? `\u2066${date}\u2069` : date
}
