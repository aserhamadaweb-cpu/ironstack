import { MOCK_PRS } from '@/lib/mock-pr-data'

/**
 * Shared training-stats aggregation used by both the Hub and Profile pages.
 * "PRs" here refers to personal records generically (a lifting term), not
 * the removed PR Arena feature.
 */
export function getTrainingStats() {
  const currentPrs = MOCK_PRS.filter((record) => record.isCurrentPr)
  const heaviest = currentPrs.reduce<number>(
    (top, record) => (record.weight > top ? record.weight : top),
    0,
  )
  const now = new Date()
  const thisMonth = MOCK_PRS.filter((record) => {
    const date = new Date(record.loggedAt)
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    )
  }).length

  return {
    activePrs: currentPrs.length,
    totalLogs: MOCK_PRS.length,
    heaviest,
    thisMonth,
  }
}

/** Shared avatar-initials helper used by DashboardNav, Hub, and Profile. */
export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const letters = parts.map((part) => part[0] ?? '').join('')
  return (letters || name[0] || 'A').toUpperCase()
}

export type HeatDay = {
  date: string
  intensity: 0 | 1 | 2 | 3 | 4
}

/**
 * Builds a GitHub-style contribution grid for the last `days` calendar days.
 * Intensity is mock-driven so the Profile heatmap always looks alive in demos.
 */
export function getMonthHeatmap(days = 84): HeatDay[] {
  const result: HeatDay[] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  // Seeded pattern: denser mid-week activity, rest days on some weekends.
  const intensityPattern: Array<0 | 1 | 2 | 3 | 4> = [
    0, 2, 3, 1, 4, 2, 0, 3, 1, 2, 4, 0, 1, 3, 2, 0, 4, 3, 1, 2, 0, 3, 4, 1, 2,
    0, 3, 2,
  ]

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const weekday = date.getDay()
    const pattern = intensityPattern[offset % intensityPattern.length]
    // Soften Sundays / some Saturdays so rest days are visible.
    const intensity =
      weekday === 0 ? (0 as const) : weekday === 6 && pattern > 2 ? (1 as const) : pattern

    result.push({
      date: date.toISOString().slice(0, 10),
      intensity,
    })
  }

  return result
}

export type LastSessionSummary = {
  name: string
  dateLabel: string
  durationMin: number
  volumeKg: number
  sets: number
  standouts: Array<{ lift: string; weight: number; reps: number; cue?: string }>
}

/** Demo last-session payload used by AI Coach + Home / Workout surfaces. */
export function getLastSessionSummary(): LastSessionSummary {
  return {
    name: 'Push Day · Push / Pull / Legs',
    dateLabel: 'Yesterday',
    durationMin: 58,
    volumeKg: 8400,
    sets: 18,
    standouts: [
      {
        lift: 'Bench Press',
        weight: 100,
        reps: 5,
        cue: 'Elbows pinned. Pause on chest.',
      },
      {
        lift: 'Overhead Press',
        weight: 60,
        reps: 8,
        cue: 'Glutes tight. No lean-back.',
      },
      {
        lift: 'Cable Fly',
        weight: 18,
        reps: 12,
      },
    ],
  }
}
