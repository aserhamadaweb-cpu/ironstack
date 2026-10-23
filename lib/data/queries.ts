import { cache } from 'react'
import { isBodyweightLogNote } from '@/lib/units'
import { resolveLibraryExercise } from '@/lib/exercise-library.server'
import { displayMuscleGroup } from '@/lib/lift-progress'
import { computeWeeklyVolumeTrend } from '@/lib/volume-trend'
import { createClient, getAuthUserId } from '@/lib/supabase/server'
import type {
  Friendship,
  LeaderboardEntry,
  LiftLog,
  LiftType,
  PersonalRecord,
  PersonalRecordWithLift,
  Profile,
  PublicProfile,
  Session,
  SessionWithRelations,
  Split,
  SplitDetailRow,
} from '@/lib/database.types'
import { fetchPublicProfilesByIds } from '@/lib/data/public-profiles'

export type DataResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

function friendlyError(fallback: string, message?: string) {
  if (!message) return fallback
  const lower = message.toLowerCase()
  if (lower.includes('jwt') || lower.includes('not authenticated')) {
    return 'Your session expired. Please sign in again.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return fallback
}

/** PostgREST may return a nested object or a one-element array for many-to-one joins. */
function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export const getProfile = cache(async function getProfile(
  userId: string,
): Promise<DataResult<Profile | null>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, bio, preferred_unit, theme_preference, language, notification_preferences, privacy_follow, privacy_friend_request, privacy_message, height_cm, gender, birth_date, current_weight_kg, is_email_verified, is_guest, username_change_count, primary_split_id, created_at, updated_at',
      )
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: friendlyError('Could not load your profile.', error.message),
      }
    }
    return { data: data as Profile | null, error: null }
  } catch (err) {
    return {
      data: null,
      error: friendlyError(
        'Could not load your profile.',
        err instanceof Error ? err.message : 'fetch failed',
      ),
    }
  }
})

export async function listBodyWeightLogs(
  userId: string,
): Promise<DataResult<import('@/lib/database.types').BodyWeightLog[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, user_id, weight_kg, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: true })

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load weight history.', error.message),
    }
  }
  return { data: data ?? [], error: null }
}

export async function getInProgressSession(
  userId: string,
): Promise<DataResult<{
  id: string
  splitId: string
  splitDayId: string
  startedAt: string
  splitName: string | null
  dayName: string | null
} | null>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, split_id, split_day_id, started_at, splits(id, name), split_days(id, name)',
    )
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your active session.', error.message),
    }
  }

  const rowRaw = Array.isArray(data) ? data[0] : data
  if (!rowRaw) return { data: null, error: null }

  const row = rowRaw as {
    id: string
    split_id: string | null
    split_day_id: string | null
    started_at: string
    splits?: { name?: string } | { name?: string }[] | null
    split_days?: { name?: string } | { name?: string }[] | null
  }
  const split = Array.isArray(row.splits) ? row.splits[0] : row.splits
  const day = Array.isArray(row.split_days) ? row.split_days[0] : row.split_days
  if (!row.split_id || !row.split_day_id) return { data: null, error: null }

  return {
    data: {
      id: row.id,
      splitId: row.split_id,
      splitDayId: row.split_day_id,
      startedAt: row.started_at,
      splitName: split?.name ?? null,
      dayName: day?.name ?? null,
    },
    error: null,
  }
}

export async function getCompletedSessions(
  userId: string,
  limit = 50,
): Promise<DataResult<SessionWithRelations[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at, splits(id, name), split_days(id, name)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your session history.', error.message),
    }
  }

  const rows = (data ?? []).map((row) => {
    const r = row as SessionWithRelations & {
      splits?: SessionWithRelations['splits'] | SessionWithRelations['splits'][]
      split_days?:
        | SessionWithRelations['split_days']
        | SessionWithRelations['split_days'][]
    }
    return {
      ...r,
      splits: oneRelation(r.splits),
      split_days: oneRelation(r.split_days),
    } as SessionWithRelations
  })

  return { data: rows, error: null }
}

export type ProgressSessionMuscle = {
  name: string
  volumeKg: number
  sets: number
}

export type ProgressSessionSummary = {
  id: string
  splitName: string
  dayName: string | null
  finishedAt: string
  durationSeconds: number
  totalVolumeKg: number
  setsCompleted: number
  setsSkipped: number
  muscles: ProgressSessionMuscle[]
}

export type MuscleProgressSummary = {
  muscle: string
  sessionCount: number
  setCount: number
  totalVolumeKg: number
  /** First session that trained this muscle vs the latest one. */
  changePct: number | null
}

export type ProgressOverview = {
  sessions: ProgressSessionSummary[]
  muscles: MuscleProgressSummary[]
  totals: {
    sessionCount: number
    totalVolumeKg: number
    totalSets: number
    totalDurationSeconds: number
  }
  weeklyBars: number[]
  loadChangePct: number | null
  loadInsight: 'empty' | 'baseline' | 'up' | 'down' | 'flat'
}

/** Completed sessions plus how each muscle's work changed from first to latest. */
export async function getProgressOverview(
  userId: string,
): Promise<DataResult<ProgressOverview>> {
  const supabase = await createClient()
  const [sessionsRes, logsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select(
        'id, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, splits(name), split_days(name)',
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from('lift_logs')
      .select(
        'session_id, weight, reps, duration_seconds, notes, logged_at, lift_types(name, muscle_group, category)',
      )
      .eq('user_id', userId)
      .or('is_skipped.is.null,is_skipped.eq.false')
      .order('logged_at', { ascending: true })
      .limit(5000),
  ])

  if (sessionsRes.error) {
    return {
      data: null,
      error: friendlyError(
        'Could not load your training summary.',
        sessionsRes.error.message,
      ),
    }
  }
  if (logsRes.error) {
    return {
      data: null,
      error: friendlyError(
        'Could not load your training summary.',
        logsRes.error.message,
      ),
    }
  }

  type LogRow = {
    session_id: string | null
    weight: number
    reps: number
    duration_seconds: number | null
    notes: string | null
    logged_at: string
    lift_types:
      | { name?: string | null; muscle_group?: string | null; category?: string | null }
      | { name?: string | null; muscle_group?: string | null; category?: string | null }[]
      | null
  }

  type Bucket = {
    at: string
    volume: number
    sets: number
    bestWeight: number
    bestReps: number
  }

  const muscleBuckets = new Map<string, Map<string, Bucket>>()
  const muscleSets = new Map<string, number>()
  const sessionMuscles = new Map<string, Map<string, { volumeKg: number; sets: number }>>()
  const sessionVolumeFromLogs = new Map<string, number>()
  const sessionSetsFromLogs = new Map<string, number>()

  for (const row of (logsRes.data ?? []) as unknown as LogRow[]) {
    const lift = oneRelation(row.lift_types)
    const muscle = displayMuscleGroup(lift?.muscle_group) || 'Other'
    const sessionKey = row.session_id ?? `day:${row.logged_at.slice(0, 10)}`
    const weight = Number(row.weight) || 0
    const reps = Number(row.reps) || 0
    const bodyweight = isBodyweightLogNote(row.notes)
    const cardio =
      (lift?.category ?? '').trim().toLowerCase() === 'cardio' ||
      (Number(row.duration_seconds) || 0) > 0
    const volume = bodyweight || cardio ? 0 : weight * reps

    let buckets = muscleBuckets.get(muscle)
    if (!buckets) {
      buckets = new Map()
      muscleBuckets.set(muscle, buckets)
    }
    const bucket = buckets.get(sessionKey) ?? {
      at: row.logged_at,
      volume: 0,
      sets: 0,
      bestWeight: 0,
      bestReps: 0,
    }
    bucket.sets += 1
    bucket.volume += volume
    if (row.logged_at < bucket.at) bucket.at = row.logged_at
    if (bodyweight || cardio) {
      if (reps > bucket.bestReps) bucket.bestReps = reps
    } else if (
      weight > bucket.bestWeight ||
      (weight === bucket.bestWeight && reps > bucket.bestReps)
    ) {
      bucket.bestWeight = weight
      bucket.bestReps = reps
    }
    buckets.set(sessionKey, bucket)
    muscleSets.set(muscle, (muscleSets.get(muscle) ?? 0) + 1)

    if (row.session_id) {
      let byMuscle = sessionMuscles.get(row.session_id)
      if (!byMuscle) {
        byMuscle = new Map()
        sessionMuscles.set(row.session_id, byMuscle)
      }
      const current = byMuscle.get(muscle) ?? { volumeKg: 0, sets: 0 }
      current.volumeKg += volume
      current.sets += 1
      byMuscle.set(muscle, current)
      sessionVolumeFromLogs.set(
        row.session_id,
        (sessionVolumeFromLogs.get(row.session_id) ?? 0) + volume,
      )
      sessionSetsFromLogs.set(
        row.session_id,
        (sessionSetsFromLogs.get(row.session_id) ?? 0) + 1,
      )
    }
  }

  const muscles: MuscleProgressSummary[] = [...muscleBuckets.entries()]
    .map(([muscle, buckets]) => {
      const ordered = [...buckets.values()].sort((a, b) => a.at.localeCompare(b.at))
      const first = ordered[0]
      const latest = ordered[ordered.length - 1]
      let changePct: number | null = null
      if (ordered.length > 1 && first && latest) {
        const firstVolume = first.volume
        const latestVolume = latest.volume
        if (firstVolume > 0 && latestVolume > 0) {
          changePct = Math.round(((latestVolume - firstVolume) / firstVolume) * 100)
        } else if (firstVolume <= 0 && latestVolume <= 0) {
          const from = first.bestReps || first.bestWeight
          const to = latest.bestReps || latest.bestWeight
          if (from > 0) changePct = Math.round(((to - from) / from) * 100)
        }
      }
      return {
        muscle,
        sessionCount: ordered.length,
        setCount: muscleSets.get(muscle) ?? 0,
        totalVolumeKg: ordered.reduce((sum, bucket) => sum + bucket.volume, 0),
        changePct,
      }
    })
    .sort((a, b) => b.totalVolumeKg - a.totalVolumeKg || a.muscle.localeCompare(b.muscle))

  type SessionRow = {
    id: string
    started_at: string
    finished_at: string | null
    duration_seconds: number | null
    total_volume: number | null
    total_sets_completed: number | null
    total_sets_skipped: number | null
    splits: { name?: string | null } | { name?: string | null }[] | null
    split_days: { name?: string | null } | { name?: string | null }[] | null
  }

  const sessions: ProgressSessionSummary[] = (
    (sessionsRes.data ?? []) as unknown as SessionRow[]
  ).map((row) => {
    const split = oneRelation(row.splits)
    const day = oneRelation(row.split_days)
    const storedVolume = Number(row.total_volume) || 0
    const storedSets = Number(row.total_sets_completed) || 0
    const musclesForSession = [...(sessionMuscles.get(row.id)?.entries() ?? [])]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets)
    return {
      id: row.id,
      splitName: split?.name?.trim() || 'Workout',
      dayName: day?.name?.trim() || null,
      finishedAt: row.finished_at ?? row.started_at,
      durationSeconds: Number(row.duration_seconds) || 0,
      totalVolumeKg: storedVolume > 0 ? storedVolume : sessionVolumeFromLogs.get(row.id) ?? 0,
      setsCompleted: storedSets > 0 ? storedSets : sessionSetsFromLogs.get(row.id) ?? 0,
      setsSkipped: Number(row.total_sets_skipped) || 0,
      muscles: musclesForSession,
    }
  })

  const totals = sessions.reduce(
    (acc, session) => {
      acc.sessionCount += 1
      acc.totalVolumeKg += session.totalVolumeKg
      acc.totalSets += session.setsCompleted
      acc.totalDurationSeconds += session.durationSeconds
      return acc
    },
    {
      sessionCount: 0,
      totalVolumeKg: 0,
      totalSets: 0,
      totalDurationSeconds: 0,
    },
  )

  const trend = computeWeeklyVolumeTrend(
    sessions.map((session) => ({
      started_at: session.finishedAt,
      finished_at: session.finishedAt,
      total_volume: session.totalVolumeKg,
    })),
  )

  return {
    data: {
      sessions,
      muscles,
      totals,
      weeklyBars: trend.bars,
      loadChangePct: trend.loadChangePct,
      loadInsight: trend.loadInsight,
    },
    error: null,
  }
}

export async function getSessionById(
  userId: string,
  sessionId: string,
): Promise<DataResult<SessionWithRelations | null>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, user_id, split_id, split_day_id, status, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, total_sets_skipped, created_at, splits(id, name), split_days(id, name)',
    )
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load that session.', error.message),
    }
  }

  if (!data) return { data: null, error: null }

  const r = data as SessionWithRelations & {
    splits?: SessionWithRelations['splits'] | SessionWithRelations['splits'][]
    split_days?:
      | SessionWithRelations['split_days']
      | SessionWithRelations['split_days'][]
  }

  return {
    data: {
      ...r,
      splits: oneRelation(r.splits),
      split_days: oneRelation(r.split_days),
    } as SessionWithRelations,
    error: null,
  }
}

export async function getSessionLiftLogs(
  sessionId: string,
): Promise<
  DataResult<
    (LiftLog & {
      lift_types: Pick<
        LiftType,
        'id' | 'name' | 'slug' | 'category' | 'image_url' | 'muscle_group'
      > | null
    })[]
  >
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lift_logs')
    .select(
      'id, user_id, lift_type_id, weight, reps, weight_unit, duration_seconds, logged_at, notes, created_at, updated_at, session_id, set_number, is_skipped, lift_types(id, name, slug, category, image_url, muscle_group)',
    )
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true })

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load lifts for this session.', error.message),
    }
  }

  type LogLift = Pick<
    LiftType,
    'id' | 'name' | 'slug' | 'category' | 'image_url' | 'muscle_group'
  >
  type LogRow = LiftLog & {
    lift_types: LogLift | LogLift[] | null
  }

  const rows = ((data ?? []) as unknown as LogRow[]).map((row) => {
    const lift = oneRelation(row.lift_types)
    const catalog = lift?.name ? resolveLibraryExercise(lift.name) : null
    return {
      ...row,
      lift_types: lift
        ? {
            ...lift,
            image_url: lift.image_url || catalog?.image || null,
            muscle_group: lift.muscle_group || catalog?.muscles[0] || null,
          }
        : null,
    }
  })

  return { data: rows, error: null }
}

export async function getTotalVolume(userId: string): Promise<DataResult<number>> {
  const supabase = await createClient()
  // Server-side sum — one row back instead of every session's total_volume.
  const aggregated = await supabase
    .from('sessions')
    .select('volume:total_volume.sum()')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .maybeSingle()

  if (!aggregated.error) {
    const row = aggregated.data as { volume?: number | null } | null
    const sum = Number(row?.volume)
    return { data: Number.isFinite(sum) ? sum : 0, error: null }
  }

  // Fallback if aggregates aren't enabled on this project.
  const { data, error } = await supabase
    .from('sessions')
    .select('total_volume')
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your total volume.', error.message),
    }
  }

  const total = (data ?? []).reduce(
    (sum, row) => sum + (Number(row.total_volume) || 0),
    0,
  )

  return { data: total, error: null }
}

export async function getSplitsForUser(userId: string): Promise<DataResult<Split[]>> {
  const supabase = await createClient()
  const fullSelect =
    'id, user_id, name, description, days_per_week, is_system, is_shared, source_split_id, category, created_at, updated_at'
  const legacySelect =
    'id, user_id, name, description, days_per_week, is_system, category, created_at, updated_at'

  // Own splits first — must remain visible when is_shared=false after unshare.
  const [ownResult, catalogResult] = await Promise.all([
    supabase
      .from('splits')
      .select(fullSelect)
      .eq('user_id', userId)
      .eq('is_system', false)
      .order('name', { ascending: true }),
    supabase
      .from('splits')
      .select(fullSelect)
      .or('user_id.is.null,is_system.eq.true')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
  ])

  let error = ownResult.error ?? catalogResult.error
  let rows: Split[] | null = null

  if (error && /is_shared|source_split_id|column/i.test(error.message)) {
    const [ownFallback, catalogFallback] = await Promise.all([
      supabase
        .from('splits')
        .select(legacySelect)
        .eq('user_id', userId)
        .eq('is_system', false)
        .order('name', { ascending: true }),
      supabase
        .from('splits')
        .select(legacySelect)
        .or('user_id.is.null,is_system.eq.true')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true }),
    ])
    error = ownFallback.error ?? catalogFallback.error
    if (!error) {
      const merged = [...(ownFallback.data ?? []), ...(catalogFallback.data ?? [])]
      const byId = new Map<string, Split>()
      for (const row of merged) {
        byId.set(row.id, row as Split)
      }
      rows = [...byId.values()]
    }
  } else if (!error) {
    const merged = [...(ownResult.data ?? []), ...(catalogResult.data ?? [])]
    const byId = new Map<string, Split>()
    for (const row of merged) {
      byId.set(row.id, row as Split)
    }
    rows = [...byId.values()]
  }

  if (error) {
    return { data: null, error: friendlyError('Could not load your splits.', error.message) }
  }
  return {
    data: (rows ?? []).map((row) => ({
      ...row,
      is_shared: Boolean(row.is_shared),
      source_split_id: row.source_split_id ?? null,
    })),
    error: null,
  }
}

export async function getSplitDetail(splitIdOrSlug: string): Promise<DataResult<SplitDetailRow | null>> {
  const supabase = await createClient()

  // Legacy frontend slugs → system split names (until a real slug column exists).
  const SLUG_ALIASES: Record<string, string> = {
    ppl: 'Push / Pull / Legs',
    ul: 'Upper / Lower',
    fb: 'Full Body',
    'full-body': 'Full Body',
    bro: 'Bro Split',
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      splitIdOrSlug,
    )

  const select = `
      id, user_id, name, description, days_per_week, is_system, is_shared, source_split_id, category, created_at, updated_at,
      split_days (
        id, split_id, name, day_order, subtitle, created_at,
        split_day_exercises (
          id, split_day_id, lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order, created_at,
          lift_types ( id, slug, name, image_url, muscle_group, category )
        )
      )
    `

  let query = supabase.from('splits').select(select)

  if (isUuid) {
    query = query.eq('id', splitIdOrSlug)
  } else if (SLUG_ALIASES[splitIdOrSlug]) {
    query = query.ilike('name', SLUG_ALIASES[splitIdOrSlug])
  } else {
    query = query.ilike('name', splitIdOrSlug.replace(/-/g, ' '))
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: friendlyError('Could not load this split.', error.message) }
  }

  if (!data) return { data: null, error: null }

  const detail = data as unknown as SplitDetailRow
  detail.is_shared = Boolean(detail.is_shared)
  detail.source_split_id = detail.source_split_id ?? null
  detail.split_days = [...(detail.split_days ?? [])]
    .sort((a, b) => a.day_order - b.day_order)
    .map((day) => ({
      ...day,
      split_day_exercises: [...(day.split_day_exercises ?? [])].sort(
        (a, b) => a.exercise_order - b.exercise_order,
      ),
    }))

  return { data: detail, error: null }
}

export async function getAcceptedFriends(
  userId: string,
): Promise<
  DataResult<Array<{ friendship: Friendship; profile: PublicProfile }>>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your training circle.', error.message),
    }
  }

  const rows = (data ?? []) as Friendship[]
  const friendIds = rows.map((row) =>
    row.user_id === userId ? row.friend_id : row.user_id,
  )

  if (friendIds.length === 0) {
    return { data: [], error: null }
  }

  const { data: profiles, error: profileError } = await fetchPublicProfilesByIds(
    supabase,
    friendIds,
  )

  if (profileError) {
    return {
      data: null,
      error: friendlyError('Could not load your training circle.', profileError),
    }
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const joined = rows
    .map((friendship) => {
      const friendId =
        friendship.user_id === userId ? friendship.friend_id : friendship.user_id
      const profile = profileMap.get(friendId)
      if (!profile) return null
      return { friendship, profile }
    })
    .filter(Boolean) as Array<{ friendship: Friendship; profile: PublicProfile }>

  return { data: joined, error: null }
}

export async function getPreviousBestForLift(
  userId: string,
  liftTypeId: string,
): Promise<DataResult<{ weight: number; reps: number } | null>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lift_logs')
    .select('weight, reps')
    .eq('user_id', userId)
    .eq('lift_type_id', liftTypeId)
    .or('is_skipped.is.null,is_skipped.eq.false')
    .order('weight', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load previous best.', error.message),
    }
  }

  if (!data) return { data: null, error: null }
  return {
    data: { weight: Number(data.weight), reps: Number(data.reps) },
    error: null,
  }
}

export async function getPreviousBestsMap(
  userId: string,
  liftTypeIds: string[],
): Promise<
  DataResult<
    Record<
      string,
      { weight: number; reps: number; durationSeconds?: number | null }
    >
  >
> {
  const unique = [...new Set(liftTypeIds.filter(Boolean))]
  if (unique.length === 0) return { data: {}, error: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lift_logs')
    .select('lift_type_id, weight, reps, duration_seconds, notes, lift_types(category)')
    .eq('user_id', userId)
    .in('lift_type_id', unique)
    .or('is_skipped.is.null,is_skipped.eq.false')

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load previous bests.', error.message),
    }
  }

  type Row = {
    lift_type_id: string
    weight: number
    reps: number
    duration_seconds: number | null
    notes: string | null
    lift_types: { category: string } | { category: string }[] | null
  }

  const map: Record<
    string,
    { weight: number; reps: number; durationSeconds?: number | null }
  > = {}
  for (const row of (data ?? []) as Row[]) {
    const category = oneRelation(row.lift_types)?.category
    const isCardio = category?.trim().toLowerCase() === 'cardio'

    if (isCardio) {
      const duration = Number(row.duration_seconds) || 0
      if (duration <= 0) continue
      const current = map[row.lift_type_id]
      if (!current?.durationSeconds || duration > current.durationSeconds) {
        map[row.lift_type_id] = {
          weight: 0,
          reps: 0,
          durationSeconds: duration,
        }
      }
      continue
    }

    const weight = Number(row.weight) || 0
    const reps = Number(row.reps) || 0
    const current = map[row.lift_type_id]
    if (isBodyweightLogNote(row.notes)) {
      if (!current || reps > current.reps) {
        map[row.lift_type_id] = { weight: 0, reps }
      }
      continue
    }
    if (!current || weight > current.weight) {
      map[row.lift_type_id] = { weight, reps }
    }
  }
  return { data: map, error: null }
}

export async function countCompletedSessions(
  userId: string,
): Promise<DataResult<number>> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not check session history.', error.message),
    }
  }
  return { data: count ?? 0, error: null }
}

export async function getCurrentPersonalRecords(
  userId: string,
): Promise<DataResult<PersonalRecordWithLift[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('personal_records')
    .select(
      'id, user_id, lift_type_id, weight, reps, is_current_pr, logged_at, lift_types(id, name, slug, muscle_group, image_url)',
    )
    .eq('user_id', userId)
    .eq('is_current_pr', true)
    .order('weight', { ascending: false })

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your personal records.', error.message),
    }
  }

  type Row = PersonalRecordWithLift & {
    lift_types:
      | PersonalRecordWithLift['lift_types']
      | NonNullable<PersonalRecordWithLift['lift_types']>[]
      | null
  }

  const rows = ((data ?? []) as unknown as Row[]).map((row) => ({
    ...row,
    lift_types: oneRelation(row.lift_types),
  }))

  return { data: rows, error: null }
}

export async function getLeaderboard(options?: {
  userIds?: string[]
  limit?: number
  orderBy?: 'streak' | 'weight'
}): Promise<DataResult<LeaderboardEntry[]>> {
  const userId = await getAuthUserId()
  if (!userId) {
    return {
      data: null,
      error: 'Sign in to view the leaderboard.',
    }
  }

  const supabase = await createClient()
  const orderBy = options?.orderBy ?? 'streak'
  let query = supabase
    .from('leaderboard')
    .select(
      'user_id, display_name, username, avatar_url, current_streak, best_lift_name, best_lift_weight, best_lift_reps',
    )
    .order(
      orderBy === 'weight' ? 'best_lift_weight' : 'current_streak',
      { ascending: false, nullsFirst: false },
    )
    .limit(options?.limit ?? 50)

  if (options?.userIds && options.userIds.length > 0) {
    query = query.in('user_id', options.userIds)
  }

  const { data, error } = await query

  if (error) {
    const lower = error.message.toLowerCase()
    if (lower.includes('permission denied') || lower.includes('42501')) {
      return {
        data: null,
        error: 'Sign in to view the leaderboard.',
      }
    }
    return {
      data: null,
      error: friendlyError('Could not load the leaderboard.', error.message),
    }
  }

  const rows = [...((data ?? []) as LeaderboardEntry[])].sort((a, b) => {
    if (orderBy === 'weight') {
      const weightDiff =
        (Number(b.best_lift_weight) || 0) - (Number(a.best_lift_weight) || 0)
      if (weightDiff !== 0) return weightDiff
      return (Number(b.current_streak) || 0) - (Number(a.current_streak) || 0)
    }
    const streakDiff =
      (Number(b.current_streak) || 0) - (Number(a.current_streak) || 0)
    if (streakDiff !== 0) return streakDiff
    return (Number(b.best_lift_weight) || 0) - (Number(a.best_lift_weight) || 0)
  })

  return { data: rows, error: null }
}

/** Current PRs plus optional history rows for the same lifts. */
export async function getPersonalRecordsBoard(
  userId: string,
): Promise<
  DataResult<{
    current: PersonalRecordWithLift[]
    history: PersonalRecordWithLift[]
  }>
> {
  const supabase = await createClient()
  const select =
    'id, user_id, lift_type_id, weight, reps, is_current_pr, logged_at, lift_types(id, name, slug, muscle_group, image_url)'

  const [currentRes, historyRes] = await Promise.all([
    supabase
      .from('personal_records')
      .select(select)
      .eq('user_id', userId)
      .eq('is_current_pr', true)
      .order('weight', { ascending: false }),
    supabase
      .from('personal_records')
      .select(select)
      .eq('user_id', userId)
      .eq('is_current_pr', false)
      .order('logged_at', { ascending: false })
      .limit(200),
  ])

  if (currentRes.error) {
    return {
      data: null,
      error: friendlyError(
        'Could not load your personal records.',
        currentRes.error.message,
      ),
    }
  }

  type Row = PersonalRecordWithLift & {
    lift_types:
      | PersonalRecordWithLift['lift_types']
      | NonNullable<PersonalRecordWithLift['lift_types']>[]
      | null
  }

  const mapRows = (data: unknown): PersonalRecordWithLift[] =>
    ((data ?? []) as unknown as Row[]).map((row) => {
      const lift = oneRelation(row.lift_types)
      return {
        ...row,
        lift_types: lift
          ? {
              ...lift,
              image_url:
                lift.image_url ||
                resolveLibraryExercise(lift.name)?.image ||
                null,
            }
          : null,
      }
    })

  return {
    data: {
      current: mapRows(currentRes.data),
      history: historyRes.error ? [] : mapRows(historyRes.data),
    },
    error: null,
  }
}

export type PracticedLiftSummary = {
  liftTypeId: string
  name: string
  muscleGroup: string | null
  imageUrl: string | null
  category: string | null
  setCount: number
  sessionCount: number
  lastLoggedAt: string
  bestWeightKg: number | null
  bestReps: number | null
  bestDurationSeconds: number | null
}

export type LiftProgressLog = {
  id: string
  liftTypeId: string
  sessionId: string | null
  weightKg: number
  reps: number
  durationSeconds: number | null
  repsOnly?: boolean
  setNumber: number | null
  loggedAt: string
}

export type LiftProgressMeta = {
  liftTypeId: string
  name: string
  muscleGroup: string | null
  imageUrl: string | null
  category: string | null
}

/** Distinct lifts the athlete has logged (non-skipped sets), with simple aggregates. */
export async function getPracticedLifts(
  userId: string,
): Promise<DataResult<PracticedLiftSummary[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lift_logs')
    .select(
      'lift_type_id, weight, reps, duration_seconds, notes, logged_at, session_id, lift_types(id, name, muscle_group, image_url, category)',
    )
    .eq('user_id', userId)
    .or('is_skipped.is.null,is_skipped.eq.false')
    .order('logged_at', { ascending: false })
    .limit(5000)

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your practiced exercises.', error.message),
    }
  }

  type Row = {
    lift_type_id: string
    weight: number
    reps: number
    duration_seconds: number | null
    notes: string | null
    logged_at: string
    session_id: string | null
    lift_types:
      | Pick<LiftType, 'id' | 'name' | 'muscle_group' | 'image_url' | 'category'>
      | Pick<LiftType, 'id' | 'name' | 'muscle_group' | 'image_url' | 'category'>[]
      | null
  }

  type Acc = {
    liftTypeId: string
    name: string
    muscleGroup: string | null
    imageUrl: string | null
    category: string | null
    setCount: number
    sessionIds: Set<string>
    lastLoggedAt: string
    bestWeightKg: number
    bestReps: number
    bestDurationSeconds: number
  }

  const byLift = new Map<string, Acc>()

  for (const row of (data ?? []) as unknown as Row[]) {
    const lift = oneRelation(row.lift_types)
    const liftTypeId = row.lift_type_id
    if (!liftTypeId) continue

    let acc = byLift.get(liftTypeId)
    if (!acc) {
      acc = {
        liftTypeId,
        name: lift?.name?.trim() || 'Exercise',
        muscleGroup: lift?.muscle_group ?? null,
        imageUrl:
          lift?.image_url || resolveLibraryExercise(lift?.name ?? '')?.image || null,
        category: lift?.category ?? null,
        setCount: 0,
        sessionIds: new Set(),
        lastLoggedAt: row.logged_at,
        bestWeightKg: 0,
        bestReps: 0,
        bestDurationSeconds: 0,
      }
      byLift.set(liftTypeId, acc)
    }

    acc.setCount += 1
    if (row.session_id) acc.sessionIds.add(row.session_id)
    if (row.logged_at > acc.lastLoggedAt) acc.lastLoggedAt = row.logged_at

    const category = (lift?.category ?? acc.category)?.trim().toLowerCase()
    const isCardio = category === 'cardio'
    if (isCardio) {
      const duration = Number(row.duration_seconds) || 0
      if (duration > acc.bestDurationSeconds) {
        acc.bestDurationSeconds = duration
      }
    } else if (isBodyweightLogNote(row.notes)) {
      const reps = Number(row.reps) || 0
      if (reps > acc.bestReps) acc.bestReps = reps
    } else {
      const weight = Number(row.weight) || 0
      const reps = Number(row.reps) || 0
      if (
        weight > acc.bestWeightKg ||
        (weight === acc.bestWeightKg && reps > acc.bestReps)
      ) {
        acc.bestWeightKg = weight
        acc.bestReps = reps
      }
    }
  }

  const summaries: PracticedLiftSummary[] = [...byLift.values()]
    .map((acc) => ({
      liftTypeId: acc.liftTypeId,
      name: acc.name,
      muscleGroup: acc.muscleGroup,
      imageUrl: acc.imageUrl,
      category: acc.category,
      setCount: acc.setCount,
      sessionCount: Math.max(acc.sessionIds.size, acc.setCount > 0 ? 1 : 0),
      lastLoggedAt: acc.lastLoggedAt,
      bestWeightKg: acc.bestWeightKg > 0 ? acc.bestWeightKg : null,
      bestReps: acc.bestReps > 0 ? acc.bestReps : null,
      bestDurationSeconds:
        acc.bestDurationSeconds > 0 ? acc.bestDurationSeconds : null,
    }))
    .sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt))

  return { data: summaries, error: null }
}

/** Full non-skipped set history for one lift, oldest → newest for charting. */
export async function getLiftProgressHistory(
  userId: string,
  liftTypeId: string,
): Promise<
  DataResult<{
    meta: LiftProgressMeta | null
    logs: LiftProgressLog[]
  }>
> {
  const id = liftTypeId.trim()
  if (!id) {
    return { data: { meta: null, logs: [] }, error: null }
  }

  const supabase = await createClient()
  const [logsRes, liftRes] = await Promise.all([
    supabase
      .from('lift_logs')
      .select(
        'id, lift_type_id, session_id, weight, reps, duration_seconds, notes, set_number, logged_at',
      )
      .eq('user_id', userId)
      .eq('lift_type_id', id)
      .or('is_skipped.is.null,is_skipped.eq.false')
      .order('logged_at', { ascending: true })
      .limit(2000),
    supabase
      .from('lift_types')
      .select('id, name, muscle_group, image_url, category')
      .eq('id', id)
      .maybeSingle(),
  ])

  if (logsRes.error) {
    return {
      data: null,
      error: friendlyError('Could not load exercise history.', logsRes.error.message),
    }
  }

  const lift = liftRes.data
  const meta: LiftProgressMeta | null = lift
    ? {
        liftTypeId: lift.id,
        name: lift.name?.trim() || 'Exercise',
        muscleGroup: lift.muscle_group ?? null,
        imageUrl:
          lift.image_url || resolveLibraryExercise(lift.name)?.image || null,
        category: lift.category ?? null,
      }
    : null

  const logs: LiftProgressLog[] = (logsRes.data ?? []).map((row) => {
    const repsOnly = isBodyweightLogNote(row.notes)
    return {
      id: row.id,
      liftTypeId: row.lift_type_id,
      sessionId: row.session_id,
      weightKg: repsOnly ? 0 : Number(row.weight) || 0,
      reps: Number(row.reps) || 0,
      durationSeconds: row.duration_seconds,
      setNumber: row.set_number,
      loggedAt: row.logged_at,
      repsOnly,
    }
  })

  return { data: { meta, logs }, error: null }
}

export async function getAcceptedFriendIds(
  userId: string,
): Promise<DataResult<string[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load your friends.', error.message),
    }
  }

  const ids = (data ?? []).map((row) =>
    row.user_id === userId ? row.friend_id : row.user_id,
  )

  return { data: [...new Set(ids as string[])], error: null }
}

export type { Session, PersonalRecord, LiftLog }
