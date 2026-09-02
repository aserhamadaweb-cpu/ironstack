export type VolumeTrendSession = {
  started_at: string
  finished_at?: string | null
  total_volume?: number | null
}

export type LoadInsightKind = 'empty' | 'baseline' | 'up' | 'down' | 'flat'

export type WeeklyVolumeTrend = {
  /** Eight bar heights (0–100) for the journey chart. */
  bars: number[]
  /** Raw weekly volume totals in kg, oldest → newest. */
  weeklyVolumes: number[]
  weeksWithSessions: number
  sessionCount: number
  /** Average session volume change: recent 4 weeks vs prior 4 weeks. */
  loadChangePct: number | null
  loadInsight: LoadInsightKind
}

const WEEK_COUNT = 8
const MIN_BAR = 4

function sessionTimestamp(session: VolumeTrendSession): number {
  const raw = session.finished_at ?? session.started_at
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

/** Monday 00:00 local time for the week containing `date`. */
export function weekStartMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function weekKey(date: Date): string {
  return weekStartMonday(date).toISOString().slice(0, 10)
}

/**
 * Build an 8-week volume trend (oldest → newest) and average-load change
 * comparing the first 4 weeks to the last 4 weeks in that window.
 */
export function computeWeeklyVolumeTrend(
  sessions: VolumeTrendSession[],
  now: Date = new Date(),
  weekCount = WEEK_COUNT,
): WeeklyVolumeTrend {
  const empty: WeeklyVolumeTrend = {
    bars: Array.from({ length: weekCount }, () => MIN_BAR),
    weeklyVolumes: Array.from({ length: weekCount }, () => 0),
    weeksWithSessions: 0,
    sessionCount: 0,
    loadChangePct: null,
    loadInsight: 'empty',
  }

  const currentWeekStart = weekStartMonday(now)
  const weekStarts: Date[] = []
  for (let i = weekCount - 1; i >= 0; i -= 1) {
    const start = new Date(currentWeekStart)
    start.setDate(start.getDate() - i * 7)
    weekStarts.push(start)
  }

  const weekIndex = new Map<string, number>()
  weekStarts.forEach((start, index) => {
    weekIndex.set(start.toISOString().slice(0, 10), index)
  })

  const weeklyVolumes = Array.from({ length: weekCount }, () => 0)
  const weeklySessionCounts = Array.from({ length: weekCount }, () => 0)
  let sessionCount = 0

  for (const session of sessions) {
    const ts = sessionTimestamp(session)
    if (!Number.isFinite(ts)) continue

    const key = weekKey(new Date(ts))
    const index = weekIndex.get(key)
    if (index === undefined) continue

    weeklyVolumes[index] += Number(session.total_volume) || 0
    weeklySessionCounts[index] += 1
    sessionCount += 1
  }

  const weeksWithSessions = weeklySessionCounts.filter((c) => c > 0).length

  const maxVol = Math.max(...weeklyVolumes, 1)
  const bars = weeklyVolumes.map((volume) =>
    volume > 0
      ? Math.max(MIN_BAR, Math.round((volume / maxVol) * 100))
      : MIN_BAR,
  )

  let loadInsight: LoadInsightKind = 'empty'
  let loadChangePct: number | null = null

  if (sessionCount === 0) {
    loadInsight = 'empty'
  } else if (sessionCount === 1 || weeksWithSessions <= 1) {
    loadInsight = 'baseline'
  } else {
    const earlySessions = weeklySessionCounts
      .slice(0, 4)
      .reduce((sum, count) => sum + count, 0)
    const lateSessions = weeklySessionCounts
      .slice(4)
      .reduce((sum, count) => sum + count, 0)
    const earlyVolume = weeklyVolumes.slice(0, 4).reduce((sum, v) => sum + v, 0)
    const lateVolume = weeklyVolumes.slice(4).reduce((sum, v) => sum + v, 0)

    const earlyAvg =
      earlySessions > 0 ? earlyVolume / earlySessions : null
    const lateAvg = lateSessions > 0 ? lateVolume / lateSessions : null

    if (earlyAvg === null || lateAvg === null || earlyAvg <= 0) {
      loadInsight = 'baseline'
    } else {
      loadChangePct = Math.round(((lateAvg - earlyAvg) / earlyAvg) * 100)
      if (loadChangePct > 2) loadInsight = 'up'
      else if (loadChangePct < -2) loadInsight = 'down'
      else loadInsight = 'flat'
    }
  }

  return {
    bars,
    weeklyVolumes,
    weeksWithSessions,
    sessionCount,
    loadChangePct,
    loadInsight,
  }
}

export function formatLoadChangePct(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}
