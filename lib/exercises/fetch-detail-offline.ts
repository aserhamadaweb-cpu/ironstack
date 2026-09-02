import { normalizeKey } from '@/lib/exercises/normalizers'
import type { ExerciseDetailDto } from '@/lib/exercises/actions'
import { padCatalogId } from '@/lib/exercises/detail-id'

type OfflineRow = {
  id: string
  name: string
  category?: string
  bodyPart?: string
  target?: string
  muscleGroup?: string
  secondaryMuscles?: string[]
  equipment?: string
  image?: string | null
  legacySlug?: string | null
}

let offlineRows: OfflineRow[] | null = null
let offlineLoad: Promise<OfflineRow[]> | null = null

async function loadOfflineRows(): Promise<OfflineRow[]> {
  if (offlineRows) return offlineRows
  if (!offlineLoad) {
    offlineLoad = fetch('/offline/exercises.json', { cache: 'force-cache' })
      .then((res) => (res.ok ? res.json() : []))
      .then((raw) => (Array.isArray(raw) ? (raw as OfflineRow[]) : []))
      .catch(() => [] as OfflineRow[])
  }
  offlineRows = await offlineLoad
  return offlineRows
}

function rowToDetail(row: OfflineRow): ExerciseDetailDto {
  return {
    sourceId: padCatalogId(row.id),
    name: row.name,
    category: row.category ?? row.bodyPart ?? '',
    bodyPart: row.bodyPart ?? '',
    target: row.target ?? '',
    muscleGroup: row.muscleGroup ?? '',
    secondaryMuscles: row.secondaryMuscles ?? [],
    equipment: (row.equipment ?? 'body weight').toLowerCase(),
    instructions: {},
    instructionSteps: {},
    image: row.image ?? '',
    gifUrl: row.image?.replace('/images/', '/gifs/').replace(/\.jpg$/i, '.gif') ?? '',
    mediaId: '',
    attribution: '',
    createdAt: '',
    legacySlug: row.legacySlug ?? null,
  }
}

function findOfflineRow(rows: OfflineRow[], id: string, name?: string): OfflineRow | null {
  const idTrim = id.trim()
  const padded = padCatalogId(idTrim)
  const nameKey = name?.trim() ? normalizeKey(name.trim()) : ''
  const idKey = normalizeKey(idTrim)

  for (const row of rows) {
    const rowId = padCatalogId(row.id)
    if (rowId === padded || row.id === idTrim) return row
    if (row.legacySlug && row.legacySlug === idTrim) return row
  }

  if (nameKey) {
    const exact = rows.find((row) => normalizeKey(row.name) === nameKey)
    if (exact) return exact
  }
  if (idKey && idKey !== nameKey) {
    const exact = rows.find((row) => normalizeKey(row.name) === idKey)
    if (exact) return exact
  }

  const needle = nameKey || idKey
  if (!needle) return null
  let best: OfflineRow | null = null
  for (const row of rows) {
    const key = normalizeKey(row.name)
    if (!key.includes(needle) && !needle.includes(key)) continue
    if (!best || row.name.length < best.name.length) best = row
  }
  return best
}

/** Client-side fallback when `/api/exercises/[id]` is unavailable or returns 404. */
export async function loadExerciseDetailOffline(
  id: string,
  name?: string,
): Promise<ExerciseDetailDto | null> {
  const rows = await loadOfflineRows()
  if (!rows.length) return null
  const hit = findOfflineRow(rows, id, name)
  return hit ? rowToDetail(hit) : null
}
