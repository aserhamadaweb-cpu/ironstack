import fs from 'node:fs'
import path from 'node:path'
import type { Exercise, ExerciseSlim, IdentityMapFile, SourceExercise } from '@/lib/exercises/types'
import { emptyIdentityMap } from '@/lib/exercises/identity'
import { parseSourceExercise, sourceToExercise } from '@/lib/exercises/normalizers'
import { exerciseToSlim } from '@/lib/exercises/adapters'

const SOURCE_CANDIDATES = [
  ['data', 'exercises-dataset', 'exercises.json'],
  ['vendor', 'exercises-dataset', 'data', 'exercises.json'],
]

const IDENTITY_PATH = ['data', 'exercises-dataset', 'identity-map.json']

let sourceCache: SourceExercise[] | null = null
let catalogCache: Exercise[] | null = null
let identityCache: IdentityMapFile | null = null
let byIdCache: Map<string, Exercise> | null = null

function readJson<T>(segments: string[]): T | null {
  const file = path.join(process.cwd(), ...segments)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export function loadIdentityMapFile(): IdentityMapFile {
  if (identityCache) return identityCache
  identityCache = readJson<IdentityMapFile>(IDENTITY_PATH) ?? emptyIdentityMap()
  return identityCache
}

export function loadSourceExercises(): SourceExercise[] {
  if (sourceCache) return sourceCache
  let raw: unknown = null
  for (const segments of SOURCE_CANDIDATES) {
    raw = readJson(segments)
    if (raw) break
  }
  if (!Array.isArray(raw)) {
    sourceCache = []
    return sourceCache
  }
  sourceCache = raw
    .map((row) => parseSourceExercise(row))
    .filter((row): row is SourceExercise => row !== null)
  return sourceCache
}

export function loadExerciseCatalog(): Exercise[] {
  if (catalogCache) return catalogCache
  const identity = loadIdentityMapFile()
  catalogCache = loadSourceExercises().map((source) =>
    sourceToExercise(source, identity.bySourceId[source.id]?.legacySlug ?? null),
  )
  return catalogCache
}

export function loadSlimExercises(): ExerciseSlim[] {
  return loadExerciseCatalog().map(exerciseToSlim)
}

function idIndex(): Map<string, Exercise> {
  if (!byIdCache) {
    byIdCache = new Map()
    for (const exercise of loadExerciseCatalog()) {
      byIdCache.set(exercise.sourceId, exercise)
    }
  }
  return byIdCache
}

export function getExerciseById(id: string): Exercise | null {
  const needle = id.trim()
  const padded = /^\d{1,4}$/.test(needle) ? needle.padStart(4, '0') : needle
  const map = idIndex()
  return map.get(needle) ?? map.get(padded) ?? null
}

export function expectedSourceCount(): number {
  return 1324
}
