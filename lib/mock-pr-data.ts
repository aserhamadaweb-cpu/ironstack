export type PersonalRecord = {
  id: string
  liftName: string
  weight: number
  reps: number
  unit: 'kg' | 'lb'
  loggedAt: string
  isCurrentPr: boolean
  notes?: string
}

export type CirclePr = {
  id: string
  name: string
  initials: string
  liftName: string
  weight: number
  unit: 'kg' | 'lb'
  loggedAt: string
  tone: string
}

export const LIFT_OPTIONS = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Front Squat',
  'Romanian Deadlift',
  'Pull-Up',
  'Dip',
] as const

export const MOCK_PRS: PersonalRecord[] = [
  {
    id: 'pr-1',
    liftName: 'Deadlift',
    weight: 220,
    reps: 1,
    unit: 'kg',
    loggedAt: '2026-07-12T09:30:00Z',
    isCurrentPr: true,
    notes: 'Locked in mid-back. Slow eccentric.',
  },
  {
    id: 'pr-2',
    liftName: 'Squat',
    weight: 180,
    reps: 1,
    unit: 'kg',
    loggedAt: '2026-07-08T07:15:00Z',
    isCurrentPr: true,
    notes: 'Depth solid. Brace before descent.',
  },
  {
    id: 'pr-3',
    liftName: 'Bench Press',
    weight: 140,
    reps: 1,
    unit: 'kg',
    loggedAt: '2026-07-05T18:45:00Z',
    isCurrentPr: true,
    notes: 'Elbows pinned. Pause on chest.',
  },
  {
    id: 'pr-4',
    liftName: 'Overhead Press',
    weight: 85,
    reps: 1,
    unit: 'kg',
    loggedAt: '2026-06-28T11:00:00Z',
    isCurrentPr: true,
    notes: 'Glutes tight. No lean-back.',
  },
  {
    id: 'pr-5',
    liftName: 'Barbell Row',
    weight: 120,
    reps: 5,
    unit: 'kg',
    loggedAt: '2026-06-20T16:20:00Z',
    isCurrentPr: false,
    notes: 'Controlled tempo — no bounce.',
  },
  {
    id: 'pr-6',
    liftName: 'Front Squat',
    weight: 130,
    reps: 3,
    unit: 'kg',
    loggedAt: '2026-06-14T08:50:00Z',
    isCurrentPr: true,
    notes: 'Elbows high throughout.',
  },
]

/** Mock friends' recent PRs for the Training Circle feed. */
export const CIRCLE_PRS: CirclePr[] = [
  {
    id: 'c1',
    name: 'Maya Chen',
    initials: 'MC',
    liftName: 'Deadlift',
    weight: 165,
    unit: 'kg',
    loggedAt: '2026-07-24T18:10:00Z',
    tone: 'border chip-amber',
  },
  {
    id: 'c2',
    name: 'Jordan Lee',
    initials: 'JL',
    liftName: 'Bench Press',
    weight: 125,
    unit: 'kg',
    loggedAt: '2026-07-23T12:40:00Z',
    tone: 'border chip-blue',
  },
  {
    id: 'c3',
    name: 'Sam Okoro',
    initials: 'SO',
    liftName: 'Squat',
    weight: 190,
    unit: 'kg',
    loggedAt: '2026-07-22T07:55:00Z',
    tone: 'border chip-green',
  },
  {
    id: 'c4',
    name: 'Riley Park',
    initials: 'RP',
    liftName: 'Overhead Press',
    weight: 72.5,
    unit: 'kg',
    loggedAt: '2026-07-21T16:20:00Z',
    tone: 'border chip-amber',
  },
]

export function formatLiftDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatWeight(weight: number, unit: 'kg' | 'lb') {
  return `${weight.toLocaleString()} ${unit}`
}

/** Epley estimate: 1RM ≈ weight × (1 + reps / 30). */
export function estimateOneRepMax(weight: number, reps: number) {
  if (reps <= 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}
