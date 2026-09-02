import type { LibraryExercise } from '@/lib/exercise-library'
import { isCardioCategory } from '@/lib/units'

const DRAFT_PREFIX = 'ironstack.split-builder.draft.'
export const CREATE_DRAFT_KEY = `${DRAFT_PREFIX}create`

type SetType = 'normal' | 'warmup' | 'failure'

type BuilderExercise = {
  uid: string
  exercise: LibraryExercise
  sets: number
  reps: string
  setType: SetType
}

type BuilderDay = {
  id: string
  name: string
  subtitle?: string | null
  exercises: BuilderExercise[]
}

export type SplitBuilderDraft = {
  step?: number
  activeDay?: number
  splitName?: string
  description?: string
  daysPerWeek?: number
  days?: BuilderDay[]
  updatedAt?: number
}

export type SplitDraftTarget = {
  key: string
  href: string
  dayIndex: number
  dayName: string
  addedCount: number
}

function emptyDays(count: number): BuilderDay[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `day-${i}`,
    name: '',
    subtitle: null,
    exercises: [],
  }))
}

function nextUid(days: BuilderDay[]): number {
  let max = 0
  for (const day of days) {
    for (const entry of day.exercises) {
      const numeric = Number(String(entry.uid).replace(/\D/g, ''))
      if (Number.isFinite(numeric)) max = Math.max(max, numeric)
    }
  }
  return max + 1
}

function readDraft(key: string): SplitBuilderDraft | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw) as SplitBuilderDraft
    if (!Array.isArray(draft.days) || draft.days.length === 0) return null
    return draft
  } catch {
    return null
  }
}

function writeDraft(key: string, draft: SplitBuilderDraft) {
  sessionStorage.setItem(key, JSON.stringify(draft))
}

function draftHref(key: string): string {
  if (key === CREATE_DRAFT_KEY) return '/dashboard/splits/create'
  if (key.startsWith(`${DRAFT_PREFIX}edit.`)) {
    const id = key.slice(`${DRAFT_PREFIX}edit.`.length)
    if (id) return `/dashboard/splits/${id}/edit`
  }
  return '/dashboard/splits/create'
}

function listDraftKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(DRAFT_PREFIX)) keys.push(key)
  }
  return keys
}

export function resolveActiveSplitDraft(): {
  key: string
  draft: SplitBuilderDraft
} | null {
  if (typeof window === 'undefined') return null
  const keys = listDraftKeys()
  let preferred: string | null = null
  let latest = -1
  for (const key of keys) {
    const draft = readDraft(key)
    if (!draft) continue
    const stamp = draft.updatedAt ?? 0
    if (stamp >= latest) {
      latest = stamp
      preferred = key
    }
  }
  if (!preferred) return null
  const draft = readDraft(preferred)
  if (!draft) return null
  return { key: preferred, draft }
}

export function peekSplitDraftTarget(): SplitDraftTarget | null {
  const active = resolveActiveSplitDraft()
  if (!active) return null
  const days = active.draft.days ?? emptyDays(3)
  const dayIndex = Math.min(
    Math.max(active.draft.activeDay ?? 0, 0),
    Math.max(days.length - 1, 0),
  )
  const day = days[dayIndex]
  return {
    key: active.key,
    href: draftHref(active.key),
    dayIndex,
    dayName: day?.name.trim() ?? '',
    addedCount: day?.exercises.length ?? 0,
  }
}

export function addExerciseToActiveSplitDraft(
  exercise: LibraryExercise,
): SplitDraftTarget {
  const existing = resolveActiveSplitDraft()
  const key = existing?.key ?? CREATE_DRAFT_KEY
  const draft = existing?.draft ?? {
    step: 2,
    activeDay: 0,
    splitName: '',
    description: '',
    daysPerWeek: 3,
    days: emptyDays(3),
  }
  const days = draft.days?.length ? draft.days : emptyDays(draft.daysPerWeek ?? 3)
  const dayIndex = Math.min(
    Math.max(draft.activeDay ?? 0, 0),
    Math.max(days.length - 1, 0),
  )
  const uid = `ex-${nextUid(days)}`
  const isCardio = isCardioCategory(exercise.category)
  const entry: BuilderExercise = {
    uid,
    exercise,
    sets: isCardio ? 1 : 3,
    reps: isCardio ? '30' : '8–12',
    setType: 'normal',
  }
  const nextDays = days.map((day, index) =>
    index === dayIndex
      ? { ...day, exercises: [...day.exercises, entry] }
      : day,
  )
  const nextDraft: SplitBuilderDraft = {
    ...draft,
    step: Math.max(draft.step ?? 0, 2),
    activeDay: dayIndex,
    daysPerWeek: nextDays.length,
    updatedAt: Date.now(),
    days: nextDays,
  }
  writeDraft(key, nextDraft)
  const day = nextDays[dayIndex]
  return {
    key,
    href: draftHref(key),
    dayIndex,
    dayName: day?.name.trim() ?? '',
    addedCount: day?.exercises.length ?? 0,
  }
}
