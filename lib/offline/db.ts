import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LiftType, PersonalRecord, SplitDetailRow } from '@/lib/database.types'
import type { SplitDetail } from '@/lib/split-data'

export type OfflineSyncStatus = 'pending' | 'syncing' | 'synced' | 'error'

export type LocalLiftLog = {
  id: string
  liftTypeId: string
  setNumber: number
  weight: number
  reps: number
  durationSeconds: number | null
  isSkipped: boolean
  loggedAt: string
  /** Reps-only set. Weight is not a load the athlete lifted. */
  bodyweight?: boolean
}

export type LocalSessionPr = {
  liftTypeId: string
  weight: number
  reps: number
}

export type SessionUiEntry = {
  weight: string
  reps: string
  durationMinutes: string
  done: boolean
  skipped: boolean
  missWeight: boolean
  missReps: boolean
  missDuration: boolean
  saved: boolean
  logId?: string
}

export type SessionUiLoggedExercise = {
  slotId: string
  name: string
  muscle: string
  liftTypeId: string
  isCardio: boolean
  isBodyweight?: boolean
  image?: string | null
  targetSets: number
  targetReps: string
  sets: Array<{
    setNumber: number
    weight: number
    reps: number
    durationSeconds?: number | null
    completed: boolean
  }>
}

export type ActiveSessionProgress = {
  splitName: string
  dayIndex: number
  dayId: string
  dayName: string
  exerciseIndex: number
  totalExercises: number
  stage: 'pick' | 'lift' | 'done' | 'summary'
  loggedExercises: SessionUiLoggedExercise[]
  currentEntries: SessionUiEntry[]
  reminderSent?: boolean
}

export type LocalSession = {
  id: string
  userId: string
  splitId: string
  splitDayId: string
  status: 'in_progress' | 'completed' | 'cancelled'
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
  logs: LocalLiftLog[]
  prs: LocalSessionPr[]
  progress?: ActiveSessionProgress | null
  syncStatus: OfflineSyncStatus
  syncError: string | null
  updatedAt: string
}

/** Set only after split snapshot + required exercise media are fully on-device. */
export type CachedSplitOfflinePin = {
  ready: boolean
  /** Relative media paths that must remain in Cache Storage. */
  requiredMedia: string[]
  readyAt: string
}

export type CachedSplit = {
  id: string
  detail: SplitDetail
  row: SplitDetailRow
  updatedAt: string
  offlinePin?: CachedSplitOfflinePin
}

export type SplitMutation = {
  id: string
  kind: 'create' | 'update'
  splitId: string
  payload: {
    id?: string
    dayIds?: string[]
    name: string
    description?: string | null
    category?: string | null
    daysPerWeek: number
    days: Array<{
      name: string
      subtitle?: string | null
      exercises: Array<{
        libraryId: string
        name: string
        muscles: string[]
        image: string | null
        sets: number
        equipment?: string
        category?: string | null
        reps?: string
      }>
    }>
  }
  syncStatus: OfflineSyncStatus
  syncError: string | null
  updatedAt: string
}

type IronStackDB = DBSchema & {
  meta: {
    key: string
    value: unknown
  }
  splits: {
    key: string
    value: CachedSplit
  }
  liftTypes: {
    key: string
    value: LiftType
  }
  personalRecords: {
    key: string
    value: PersonalRecord
  }
  sessions: {
    key: string
    value: LocalSession
    indexes: { 'by-sync': OfflineSyncStatus; 'by-user': string }
  }
  splitMutations: {
    key: string
    value: SplitMutation
  }
}

const DB_NAME = 'ironstack-offline'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<IronStackDB>> | null = null

export function getOfflineDb() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available.')
  }
  if (!dbPromise) {
    dbPromise = openDB<IronStackDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta')
        }
        if (!db.objectStoreNames.contains('splits')) {
          db.createObjectStore('splits', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('liftTypes')) {
          db.createObjectStore('liftTypes', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('personalRecords')) {
          db.createObjectStore('personalRecords', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
          sessions.createIndex('by-sync', 'syncStatus')
          sessions.createIndex('by-user', 'userId')
        }
        if (!db.objectStoreNames.contains('splitMutations')) {
          db.createObjectStore('splitMutations', { keyPath: 'id' })
        }
      },
    }).catch((err) => {
      // Allow a later retry after a transient open failure (private mode flicker, etc.).
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}
