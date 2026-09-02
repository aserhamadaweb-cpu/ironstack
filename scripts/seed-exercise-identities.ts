/**
 * Insert lift_types for unmatched Gym visual catalog rows.
 *
 * SAFE:
 * - never deletes lift_types
 * - never changes existing UUIDs or slugs
 * - matches existing rows by identity-map slug, then name
 * - inserts only when there is no match
 *
 * Usage: npx tsx scripts/seed-exercise-identities.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

type SourceExercise = {
  id: string
  name: string
  category: string
  body_part: string
  target: string
  muscle_group: string
  image: string
}

type IdentityMap = {
  bySourceId: Record<string, { legacySlug: string; oldCatalogId: string }>
}

type LiftRow = {
  id: string
  slug: string
  name: string
}

const MUSCLE_MAP: Record<string, string> = {
  abs: 'ABS',
  abdominals: 'ABS',
  pectorals: 'CHEST',
  chest: 'CHEST',
  lats: 'BACK',
  'upper back': 'BACK',
  'lower back': 'BACK',
  spine: 'BACK',
  delts: 'SHOULDERS',
  deltoids: 'SHOULDERS',
  shoulders: 'SHOULDERS',
  biceps: 'BICEPS',
  triceps: 'TRICEPS',
  quads: 'QUADS',
  quadriceps: 'QUADS',
  hamstrings: 'HAMSTRINGS',
  glutes: 'GLUTES',
  calves: 'CALVES',
  forearms: 'FOREARMS',
  traps: 'TRAPS',
  trapezius: 'TRAPS',
  neck: 'NECK',
  'levator scapulae': 'NECK',
  abductors: 'ABDUCTORS',
  adductors: 'ADDUCTORS',
  'cardiovascular system': 'CARDIO',
}

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(root, '.env.local'), 'utf8')
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=')
        let v = line.slice(i + 1)
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1)
        }
        return [line.slice(0, i), v]
      }),
  )
}

function slugFromValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function muscleGroupOf(exercise: SourceExercise): string {
  const raw = (exercise.target || exercise.muscle_group || '').toLowerCase().trim()
  if (!raw) return 'OTHER'
  return MUSCLE_MAP[raw] ?? raw.replace(/\s+/g, '_').toUpperCase()
}

function categoryOf(exercise: SourceExercise): string {
  return exercise.body_part === 'cardio' || exercise.category === 'cardio'
    ? 'cardio'
    : 'compound'
}

function imageUrlOf(exercise: SourceExercise): string {
  const file = exercise.image.replace(/^images\//, '')
  return `/exercises/images/${file}`
}

async function fetchAllLifts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
): Promise<LiftRow[]> {
  const rows: LiftRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('lift_types')
      .select('id, slug, name')
      .range(from, from + PAGE - 1)
    if (error) throw error
    const batch = (data ?? []) as LiftRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const source = JSON.parse(
    readFileSync(resolve(root, 'data/exercises-dataset/exercises.json'), 'utf8'),
  ) as SourceExercise[]
  const identity = JSON.parse(
    readFileSync(resolve(root, 'data/exercises-dataset/identity-map.json'), 'utf8'),
  ) as IdentityMap

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const existing = await fetchAllLifts(sb)
  const bySlug = new Map(existing.map((row) => [row.slug, row]))
  const byName = new Map(
    existing.map((row) => [row.name.trim().toLowerCase(), row]),
  )

  let matched = 0
  let inserted = 0
  let imageUpdated = 0
  let errors = 0
  const errorSamples: string[] = []
  const usedSlugs = new Set(bySlug.keys())

  const pendingInserts: Array<{
    slug: string
    name: string
    category: string
    muscle_group: string
    image_url: string
    is_system: true
    sort_order: number
  }> = []

  for (const [index, exercise] of source.entries()) {
    const mappedSlug = identity.bySourceId[exercise.id]?.legacySlug
    const nameKey = exercise.name.trim().toLowerCase()
    const existingRow =
      (mappedSlug ? bySlug.get(mappedSlug) : undefined) ??
      byName.get(nameKey)

    if (existingRow) {
      matched += 1
      const nextImage = imageUrlOf(exercise)
      const { error } = await sb
        .from('lift_types')
        .update({ image_url: nextImage })
        .eq('id', existingRow.id)
      if (error) {
        errors += 1
        errorSamples.push(`${exercise.id} image update: ${error.message}`)
      } else {
        imageUpdated += 1
      }
      continue
    }

    let slug = slugFromValue(exercise.name) || `gv_${exercise.id}`
    if (usedSlugs.has(slug)) slug = `gv_${exercise.id}_${slug}`.slice(0, 80)
    usedSlugs.add(slug)
    pendingInserts.push({
      slug,
      name: exercise.name,
      category: categoryOf(exercise),
      muscle_group: muscleGroupOf(exercise),
      image_url: imageUrlOf(exercise),
      is_system: true,
      sort_order: 2000 + index,
    })
  }

  const BATCH = 50
  for (let i = 0; i < pendingInserts.length; i += BATCH) {
    const batch = pendingInserts.slice(i, i + BATCH)
    const { data, error } = await sb
      .from('lift_types')
      .insert(batch)
      .select('id')
    if (error) {
      errors += batch.length
      errorSamples.push(`insert batch ${i}: ${error.message}`)
      continue
    }
    inserted += data?.length ?? batch.length
  }

  const report = {
    sourceCount: source.length,
    existingBefore: existing.length,
    matchedExisting: matched,
    insertedNew: inserted,
    imageUpdated,
    errors,
    errorSamples: errorSamples.slice(0, 8),
    uuidsChanged: 0,
    rowsDeleted: 0,
  }
  console.log(JSON.stringify(report, null, 2))
  if (errors) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
