import { createClient } from '@/lib/supabase/server'
import type {
  Friendship,
  LeaderboardEntry,
  LiftLog,
  LiftType,
  PersonalRecord,
  PersonalRecordWithLift,
  Profile,
  Session,
  SessionWithRelations,
  Split,
  SplitDetailRow,
} from '@/lib/database.types'

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

export async function getProfile(userId: string): Promise<DataResult<Profile | null>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, preferred_unit, theme_preference, language, notification_preferences, privacy_follow, privacy_friend_request, privacy_message, height_cm, gender, birth_date, current_weight_kg, is_email_verified, is_guest, created_at, updated_at',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return { data: null, error: friendlyError('Could not load your profile.', error.message) }
  }
  return { data: data as Profile | null, error: null }
}

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
      lift_types: Pick<LiftType, 'id' | 'name' | 'slug' | 'category'> | null
    })[]
  >
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lift_logs')
    .select(
      'id, user_id, lift_type_id, weight, reps, weight_unit, duration_seconds, logged_at, notes, created_at, updated_at, session_id, set_number, is_skipped, lift_types(id, name, slug, category)',
    )
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true })

  if (error) {
    return {
      data: null,
      error: friendlyError('Could not load lifts for this session.', error.message),
    }
  }

  type LogRow = LiftLog & {
    lift_types:
      | Pick<LiftType, 'id' | 'name' | 'slug' | 'category'>
      | Pick<LiftType, 'id' | 'name' | 'slug' | 'category'>[]
      | null
  }

  const rows = ((data ?? []) as unknown as LogRow[]).map((row) => ({
    ...row,
    lift_types: oneRelation(row.lift_types),
  }))

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
  // System splits (user_id is null) + the athlete's own custom splits.
  const fullSelect =
    'id, user_id, name, description, days_per_week, is_system, is_shared, source_split_id, category, created_at, updated_at'
  const legacySelect =
    'id, user_id, name, description, days_per_week, is_system, category, created_at, updated_at'

  const primary = await supabase
    .from('splits')
    .select(fullSelect)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  let rows = primary.data as Split[] | null
  let error = primary.error

  if (error && /is_shared|source_split_id|column/i.test(error.message)) {
    const fallback = await supabase
      .from('splits')
      .select(legacySelect)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('is_system', { ascending: false })
      .order('name', { ascending: true })
    rows = (fallback.data ?? null) as Split[] | null
    error = fallback.error
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
          id, split_day_id, lift_type_id, target_sets, exercise_order, created_at,
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
): Promise<DataResult<Array<{ friendship: Friendship; profile: Profile }>>> {
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

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, preferred_unit, created_at, updated_at')
    .in('id', friendIds)

  if (profileError) {
    return {
      data: null,
      error: friendlyError('Could not load your training circle.', profileError.message),
    }
  }

  const profileMap = new Map((profiles as Profile[]).map((p) => [p.id, p]))
  const joined = rows
    .map((friendship) => {
      const friendId =
        friendship.user_id === userId ? friendship.friend_id : friendship.user_id
      const profile = profileMap.get(friendId)
      if (!profile) return null
      return { friendship, profile }
    })
    .filter(Boolean) as Array<{ friendship: Friendship; profile: Profile }>

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
    .select('lift_type_id, weight, reps, duration_seconds, lift_types(category)')
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
    ((data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      lift_types: oneRelation(row.lift_types),
    }))

  return {
    data: {
      current: mapRows(currentRes.data),
      history: historyRes.error ? [] : mapRows(historyRes.data),
    },
    error: null,
  }
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
