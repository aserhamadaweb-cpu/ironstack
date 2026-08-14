export type HeatmapCell = {
  date: string
  volume: number
  sets: number
  intensity: 0 | 1 | 2 | 3 | 4
}

type SessionHeatInput = {
  started_at: string
  finished_at: string | null
  total_volume: number | null
  total_sets_completed: number | null
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfLocalDay(d: Date): Date {
  const next = new Date(d)
  next.setHours(12, 0, 0, 0)
  return next
}

function intensityFromRatio(ratio: number): 1 | 2 | 3 | 4 {
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

/**
 * GitHub-style contribution grid for the last `weeks` weeks (Sun→Sat columns).
 * Intensity scales by that day's total volume (fallback: sets).
 */
export function buildActivityHeatmap(
  sessions: SessionHeatInput[],
  weeks = 13,
): HeatmapCell[] {
  const today = startOfLocalDay(new Date())
  const end = new Date(today)
  // Align end to Saturday of current week so the last column is complete-ish.
  const endDow = end.getDay() // 0 Sun … 6 Sat
  if (endDow < 6) {
    end.setDate(end.getDate() + (6 - endDow))
  }

  const start = new Date(end)
  start.setDate(end.getDate() - (weeks * 7 - 1))
  // Align start to Sunday
  start.setDate(start.getDate() - start.getDay())

  const byDay = new Map<string, { volume: number; sets: number }>()
  for (const session of sessions) {
    const when = new Date(session.finished_at ?? session.started_at)
    const key = localDateKey(startOfLocalDay(when))
    const prev = byDay.get(key) ?? { volume: 0, sets: 0 }
    prev.volume += Number(session.total_volume) || 0
    prev.sets += Number(session.total_sets_completed) || 0
    byDay.set(key, prev)
  }

  let maxScore = 0
  for (const day of byDay.values()) {
    const score = day.volume > 0 ? day.volume : day.sets
    if (score > maxScore) maxScore = score
  }

  const cells: HeatmapCell[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = localDateKey(cursor)
    const stats = byDay.get(key) ?? { volume: 0, sets: 0 }
    const score = stats.volume > 0 ? stats.volume : stats.sets
    const intensity: HeatmapCell['intensity'] =
      score <= 0 || maxScore <= 0
        ? 0
        : intensityFromRatio(score / maxScore)

    cells.push({
      date: key,
      volume: stats.volume,
      sets: stats.sets,
      intensity,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return cells
}

export function formatHeatmapTooltip(
  cell: HeatmapCell,
  unit: 'kg' | 'lb' = 'kg',
): string {
  const d = new Date(`${cell.date}T12:00:00`)
  const label = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  if (cell.intensity === 0) return `${label} — Rest day`
  const display = unit === 'lb' ? cell.volume * 2.2046226218 : cell.volume
  const vol =
    display >= 1000
      ? `${(display / 1000).toFixed(1)}k ${unit}`
      : `${Math.round(display)} ${unit}`
  return `${label} — ${vol}, ${cell.sets} sets`
}
