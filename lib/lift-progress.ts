import { muscleDisplayLabel } from '@/lib/exercises/normalizers'
import type { LiftProgressLog } from '@/lib/data/queries'
import { isCardioCategory } from '@/lib/units'
import {
  formatLoadChangePct,
  weekStartMonday,
  type LoadInsightKind,
} from '@/lib/volume-trend'

const WEEK_COUNT = 8
const MIN_BAR = 4

export type LiftSessionGroup = {
  key: string
  sessionId: string | null
  loggedAt: string
  sets: LiftProgressLog[]
  bestWeightKg: number
  bestReps: number
  bestDurationSeconds: number
  volumeKg: number
}

export type LiftProgressAnalytics = {
  isCardio: boolean
  sessionCount: number
  setCount: number
  firstLoggedAt: string | null
  lastLoggedAt: string | null
  bestWeightKg: number | null
  bestReps: number | null
  bestDurationSeconds: number | null
  firstBestWeightKg: number | null
  latestBestWeightKg: number | null
  firstBestDurationSeconds: number | null
  latestBestDurationSeconds: number | null
  /** Percent change from first session best → latest session best. */
  sinceStartPct: number | null
  /** 8-week spark bars (0–100), oldest → newest. */
  weeklyBars: number[]
  weeklyValues: number[]
  weeksWithData: number
  loadChangePct: number | null
  loadInsight: LoadInsightKind
  sessions: LiftSessionGroup[]
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekKey(date: Date): string {
  return weekStartMonday(date).toISOString().slice(0, 10)
}

export function displayMuscleGroup(raw: string | null | undefined): string {
  return muscleDisplayLabel(raw)
}

/** Group logs into sessions (or calendar days when session_id is missing). */
export function groupLiftLogsBySession(
  logs: LiftProgressLog[],
): LiftSessionGroup[] {
  const map = new Map<string, LiftSessionGroup>()

  for (const log of logs) {
    const key = log.sessionId
      ? `session:${log.sessionId}`
      : `day:${dayKey(log.loggedAt)}`
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        sessionId: log.sessionId,
        loggedAt: log.loggedAt,
        sets: [],
        bestWeightKg: 0,
        bestReps: 0,
        bestDurationSeconds: 0,
        volumeKg: 0,
      }
      map.set(key, group)
    }
    group.sets.push(log)
    if (log.loggedAt > group.loggedAt) group.loggedAt = log.loggedAt

    const weight = Number(log.weightKg) || 0
    const reps = Number(log.reps) || 0
    const duration = Number(log.durationSeconds) || 0
    if (
      weight > group.bestWeightKg ||
      (weight === group.bestWeightKg && reps > group.bestReps)
    ) {
      group.bestWeightKg = weight
      group.bestReps = reps
    }
    if (duration > group.bestDurationSeconds) {
      group.bestDurationSeconds = duration
    }
    if (!log.repsOnly) group.volumeKg += weight * reps
  }

  for (const group of map.values()) {
    group.sets.sort((a, b) => {
      const setA = a.setNumber ?? 0
      const setB = b.setNumber ?? 0
      if (setA !== setB) return setA - setB
      return a.loggedAt.localeCompare(b.loggedAt)
    })
  }

  return [...map.values()].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
}

function pctChange(from: number, to: number): number | null {
  if (!(from > 0) || !Number.isFinite(to)) return null
  return Math.round(((to - from) / from) * 100)
}

/**
 * Build per-lift progress analytics from chronological logs (oldest → newest).
 */
export function buildLiftProgressAnalytics(
  logs: LiftProgressLog[],
  category: string | null | undefined,
  now: Date = new Date(),
): LiftProgressAnalytics {
  const isCardio = isCardioCategory(category)
  const sessions = groupLiftLogsBySession(logs)
  const chronological = [...sessions].sort((a, b) =>
    a.loggedAt.localeCompare(b.loggedAt),
  )

  const empty: LiftProgressAnalytics = {
    isCardio,
    sessionCount: 0,
    setCount: 0,
    firstLoggedAt: null,
    lastLoggedAt: null,
    bestWeightKg: null,
    bestReps: null,
    bestDurationSeconds: null,
    firstBestWeightKg: null,
    latestBestWeightKg: null,
    firstBestDurationSeconds: null,
    latestBestDurationSeconds: null,
    sinceStartPct: null,
    weeklyBars: Array.from({ length: WEEK_COUNT }, () => MIN_BAR),
    weeklyValues: Array.from({ length: WEEK_COUNT }, () => 0),
    weeksWithData: 0,
    loadChangePct: null,
    loadInsight: 'empty',
    sessions,
  }

  if (logs.length === 0) return empty

  let bestWeightKg = 0
  let bestReps = 0
  let bestDurationSeconds = 0
  for (const log of logs) {
    const weight = Number(log.weightKg) || 0
    const reps = Number(log.reps) || 0
    const duration = Number(log.durationSeconds) || 0
    if (
      weight > bestWeightKg ||
      (weight === bestWeightKg && reps > bestReps)
    ) {
      bestWeightKg = weight
      bestReps = reps
    }
    if (duration > bestDurationSeconds) bestDurationSeconds = duration
  }

  const first = chronological[0]
  const latest = chronological[chronological.length - 1]

  const firstBestWeightKg = first?.bestWeightKg || null
  const latestBestWeightKg = latest?.bestWeightKg || null
  const firstBestDurationSeconds = first?.bestDurationSeconds || null
  const latestBestDurationSeconds = latest?.bestDurationSeconds || null

  const sinceStartPct = isCardio
    ? pctChange(
        firstBestDurationSeconds ?? 0,
        latestBestDurationSeconds ?? 0,
      )
    : pctChange(firstBestWeightKg ?? 0, latestBestWeightKg ?? 0)

  // 8-week spark: weekly best weight (or best duration for cardio)
  const currentWeekStart = weekStartMonday(now)
  const weekStarts: Date[] = []
  for (let i = WEEK_COUNT - 1; i >= 0; i -= 1) {
    const start = new Date(currentWeekStart)
    start.setDate(start.getDate() - i * 7)
    weekStarts.push(start)
  }
  const weekIndex = new Map<string, number>()
  weekStarts.forEach((start, index) => {
    weekIndex.set(start.toISOString().slice(0, 10), index)
  })

  const weeklyValues = Array.from({ length: WEEK_COUNT }, () => 0)
  const weeklyCounts = Array.from({ length: WEEK_COUNT }, () => 0)

  for (const session of chronological) {
    const ts = new Date(session.loggedAt).getTime()
    if (!Number.isFinite(ts)) continue
    const index = weekIndex.get(weekKey(new Date(ts)))
    if (index === undefined) continue
    const value = isCardio
      ? session.bestDurationSeconds
      : session.bestWeightKg
    if (value > weeklyValues[index]) weeklyValues[index] = value
    weeklyCounts[index] += 1
  }

  const weeksWithData = weeklyCounts.filter((c) => c > 0).length
  const maxVal = Math.max(...weeklyValues, 1)
  const weeklyBars = weeklyValues.map((value) =>
    value > 0
      ? Math.max(MIN_BAR, Math.round((value / maxVal) * 100))
      : MIN_BAR,
  )

  let loadInsight: LoadInsightKind = 'empty'
  let loadChangePct: number | null = null

  if (chronological.length === 0) {
    loadInsight = 'empty'
  } else if (chronological.length === 1 || weeksWithData <= 1) {
    loadInsight = 'baseline'
  } else {
    const earlyVals = weeklyValues.slice(0, 4).filter((v) => v > 0)
    const lateVals = weeklyValues.slice(4).filter((v) => v > 0)
    const earlyAvg =
      earlyVals.length > 0
        ? earlyVals.reduce((s, v) => s + v, 0) / earlyVals.length
        : null
    const lateAvg =
      lateVals.length > 0
        ? lateVals.reduce((s, v) => s + v, 0) / lateVals.length
        : null

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
    isCardio,
    sessionCount: sessions.length,
    setCount: logs.length,
    firstLoggedAt: first?.loggedAt ?? null,
    lastLoggedAt: latest?.loggedAt ?? null,
    bestWeightKg: bestWeightKg > 0 ? bestWeightKg : null,
    bestReps: bestReps > 0 ? bestReps : null,
    bestDurationSeconds:
      bestDurationSeconds > 0 ? bestDurationSeconds : null,
    firstBestWeightKg:
      firstBestWeightKg && firstBestWeightKg > 0 ? firstBestWeightKg : null,
    latestBestWeightKg:
      latestBestWeightKg && latestBestWeightKg > 0 ? latestBestWeightKg : null,
    firstBestDurationSeconds:
      firstBestDurationSeconds && firstBestDurationSeconds > 0
        ? firstBestDurationSeconds
        : null,
    latestBestDurationSeconds:
      latestBestDurationSeconds && latestBestDurationSeconds > 0
        ? latestBestDurationSeconds
        : null,
    sinceStartPct,
    weeklyBars,
    weeklyValues,
    weeksWithData,
    loadChangePct,
    loadInsight,
    sessions,
  }
}

export { formatLoadChangePct }
