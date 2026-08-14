/**
 * One-time (safe to re-run) seed of free-exercise-db into public.lift_types.
 *
 * Usage: npx tsx scripts/seed-exercises.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

/** Matches rebuild-system-split-exercises.mjs / live uppercase tags. */
const MUSCLE_MAP: Record<string, string> = {
  abdominals: 'ABS',
  abductors: 'ABDUCTORS',
  adductors: 'ADDUCTORS',
  biceps: 'BICEPS',
  calves: 'CALVES',
  chest: 'CHEST',
  forearms: 'FOREARMS',
  glutes: 'GLUTES',
  hamstrings: 'HAMSTRINGS',
  lats: 'BACK',
  'lower back': 'BACK',
  'middle back': 'BACK',
  neck: 'NECK',
  quadriceps: 'QUADS',
  shoulders: 'SHOULDERS',
  traps: 'TRAPS',
  triceps: 'TRICEPS',
}

type RawExercise = {
  id: string
  name: string
  category: string
  primaryMuscles?: string[]
  images?: string[]
}

type LiftRow = {
  slug: string
  name: string
  category: string
  muscle_group: string
  image_url: string | null
  is_system: true
  sort_order: number
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

function slugFromId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function muscleGroupOf(exercise: RawExercise): string {
  const raw = (exercise.primaryMuscles?.[0] || '').toLowerCase().trim()
  if (!raw) return 'OTHER'
  return MUSCLE_MAP[raw] ?? raw.replace(/\s+/g, '_').toUpperCase()
}

function categoryOf(exercise: RawExercise): string {
  const raw = (exercise.category || 'strength').trim().toLowerCase()
  return raw || 'strength'
}

function imageUrlOf(exercise: RawExercise): string | null {
  const path = exercise.images?.[0]
  return path ? `${IMAGE_BASE}/${path}` : null
}

function toRow(exercise: RawExercise, index: number): LiftRow {
  const slug = slugFromId(exercise.id)
  if (!slug) {
    throw new Error(`Empty slug for exercise: ${exercise.name}`)
  }
  return {
    slug,
    name: exercise.name,
    category: categoryOf(exercise),
    muscle_group: muscleGroupOf(exercise),
    image_url: imageUrlOf(exercise),
    is_system: true,
    sort_order: 1000 + index,
  }
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const exercises = JSON.parse(
    readFileSync(resolve(root, 'data/data/exercises.json'), 'utf8'),
  ) as RawExercise[]

  console.log(`Loaded ${exercises.length} exercises from data/data/exercises.json`)

  const rows = exercises.map((ex, i) => toRow(ex, i))
  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  if (bySlug.size !== rows.length) {
    console.warn(
      `Warning: ${rows.length - bySlug.size} duplicate slugs in dataset; last wins`,
    )
  }
  const uniqueRows = [...bySlug.values()]

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { count: beforeCount, error: beforeError } = await sb
    .from('lift_types')
    .select('id', { count: 'exact', head: true })
  if (beforeError) throw beforeError
  console.log(`lift_types before: ${beforeCount ?? 0}`)

  const BATCH = 100
  let written = 0
  let errors = 0
  const errorSamples: string[] = []

  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const batch = uniqueRows.slice(i, i + BATCH)
    const { data, error } = await sb
      .from('lift_types')
      .upsert(batch, { onConflict: 'slug' })
      .select('id')

    if (error) {
      errors += batch.length
      errorSamples.push(`[batch ${i}-${i + batch.length}]: ${error.message}`)
      console.error(`Batch failed @${i}:`, error.message)
      continue
    }

    written += data?.length ?? batch.length
    process.stdout.write(
      `\rUpserted ${Math.min(i + batch.length, uniqueRows.length)} / ${uniqueRows.length}`,
    )
  }
  process.stdout.write('\n')

  const { count: afterCount, error: afterError } = await sb
    .from('lift_types')
    .select('id', { count: 'exact', head: true })
  if (afterError) throw afterError

  const before = beforeCount ?? 0
  const after = afterCount ?? 0
  const netNew = Math.max(0, after - before)
  const skippedOrUpdated = Math.max(0, written - netNew)

  console.log('---')
  console.log(`written (upsert returned): ${written}`)
  console.log(`net new rows:              ${netNew}`)
  console.log(`skipped/duplicates/updated:${skippedOrUpdated}`)
  console.log(`errors:                    ${errors}`)
  console.log(`lift_types after:          ${after}`)
  if (errorSamples.length) {
    console.log('error samples:')
    for (const sample of errorSamples.slice(0, 5)) console.log(' ', sample)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
