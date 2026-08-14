'use server'

import { revalidatePath } from 'next/cache'
import type {
  Challenge,
  ChallengeStatus,
  ChallengeWithRelations,
  LiftType,
  Profile,
} from '@/lib/database.types'
import { createClient } from '@/lib/supabase/server'
import { displayToKg, type WeightUnit } from '@/lib/units'

type ProfileLite = Pick<
  Profile,
  'id' | 'username' | 'display_name' | 'avatar_url'
>

type LiftLite = Pick<
  LiftType,
  'id' | 'name' | 'slug' | 'muscle_group' | 'category'
>

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function loadProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', unique)
  return new Map(((data ?? []) as ProfileLite[]).map((p) => [p.id, p]))
}

async function hydrateChallenges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Array<
    Challenge & {
      lift_types?: LiftLite | LiftLite[] | null
    }
  >,
): Promise<ChallengeWithRelations[]> {
  const profileIds = rows.flatMap((row) =>
    [row.creator_id, row.opponent_id, row.winner_id].filter(
      (id): id is string => Boolean(id),
    ),
  )
  const profiles = await loadProfiles(supabase, profileIds)

  return rows.map((row) => ({
    id: row.id,
    creator_id: row.creator_id,
    opponent_id: row.opponent_id,
    lift_type_id: row.lift_type_id,
    target_weight: Number(row.target_weight),
    target_reps: Number(row.target_reps),
    status: row.status,
    winner_id: row.winner_id,
    created_at: row.created_at,
    completed_at: row.completed_at,
    responded_at: row.responded_at,
    lift_types: oneRelation(row.lift_types),
    creator: profiles.get(row.creator_id) ?? null,
    opponent: profiles.get(row.opponent_id) ?? null,
    winner: row.winner_id ? (profiles.get(row.winner_id) ?? null) : null,
  }))
}

export async function listLiftTypesForChallenges(): Promise<LiftLite[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lift_types')
    .select('id, name, slug, muscle_group, category')
    .order('name', { ascending: true })

  if (error) {
    console.error('[challenges] lift_types', error.message)
    return []
  }
  return (data ?? []) as LiftLite[]
}

export async function listMyChallenges(
  userId: string,
): Promise<ChallengeWithRelations[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('challenges')
    .select(
      'id, creator_id, opponent_id, lift_type_id, target_weight, target_reps, status, winner_id, created_at, completed_at, responded_at, lift_types(id, name, slug, muscle_group)',
    )
    .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[challenges] list', error.message)
    return []
  }

  return hydrateChallenges(
    supabase,
    (data ?? []) as Array<Challenge & { lift_types?: LiftLite | LiftLite[] | null }>,
  )
}

export async function getChallengesHomeSummary(userId: string): Promise<{
  activeCount: number
  pendingIncoming: number
  latest: ChallengeWithRelations | null
}> {
  const all = await listMyChallenges(userId)
  const activeCount = all.filter((c) => c.status === 'active').length
  const pendingIncoming = all.filter(
    (c) => c.status === 'pending' && c.opponent_id === userId,
  ).length
  const latest =
    all.find((c) => c.status === 'active' || c.status === 'pending') ??
    all[0] ??
    null
  return { activeCount, pendingIncoming, latest }
}

export async function createChallengeAction(input: {
  opponentId: string
  liftTypeId: string
  targetWeight: number
  targetReps: number
  unit?: WeightUnit
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')

  const opponentId = input.opponentId.trim()
  if (!opponentId || opponentId === user.id) {
    return fail('Pick a friend to challenge.')
  }

  const displayWeight = Number(input.targetWeight)
  const reps = Math.round(Number(input.targetReps))
  if (!Number.isFinite(displayWeight) || displayWeight <= 0) {
    return fail('Enter a valid target weight.')
  }
  if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
    return fail('Enter a valid target rep count (1–100).')
  }
  if (!input.liftTypeId) return fail('Pick an exercise.')

  const unit = input.unit === 'lb' ? 'lb' : 'kg'
  const weightKg =
    Math.round(displayToKg(displayWeight, unit) * 100) / 100

  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${opponentId}),and(user_id.eq.${opponentId},friend_id.eq.${user.id})`,
    )
    .maybeSingle()

  if (!friendship) {
    return fail('You can only challenge someone you are already friends with.')
  }

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: user.id,
      opponent_id: opponentId,
      lift_type_id: input.liftTypeId,
      target_weight: weightKg,
      target_reps: reps,
      status: 'pending' satisfies ChallengeStatus,
    })
    .select('id')
    .single()

  if (error || !data) {
    return fail(error?.message || 'Could not create the challenge.')
  }

  revalidatePath('/dashboard/challenges')
  revalidatePath('/dashboard/home')
  return { ok: true, id: data.id as string }
}

async function respondToChallenge(
  challengeId: string,
  nextStatus: Extract<ChallengeStatus, 'active' | 'declined' | 'cancelled'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return fail('Not signed in.')

  const { data: row, error: loadError } = await supabase
    .from('challenges')
    .select('id, creator_id, opponent_id, status')
    .eq('id', challengeId)
    .maybeSingle()

  if (loadError || !row) return fail('Challenge not found.')

  if (row.status !== 'pending' && nextStatus !== 'cancelled') {
    return fail('This challenge is no longer pending.')
  }

  if (nextStatus === 'cancelled') {
    if (row.creator_id !== user.id) {
      return fail('Only the challenger can cancel.')
    }
    if (row.status !== 'pending' && row.status !== 'active') {
      return fail("This challenge can't be cancelled.")
    }
  } else if (row.opponent_id !== user.id) {
    return fail('Only the opponent can accept or decline.')
  }

  const patch: Record<string, unknown> = {
    status: nextStatus,
  }
  if (nextStatus === 'active' || nextStatus === 'declined') {
    patch.responded_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('challenges')
    .update(patch)
    .eq('id', challengeId)

  if (error) return fail(error.message)

  revalidatePath('/dashboard/challenges')
  revalidatePath('/dashboard/home')
  return { ok: true }
}

export async function acceptChallengeAction(challengeId: string) {
  return respondToChallenge(challengeId, 'active')
}

export async function declineChallengeAction(challengeId: string) {
  return respondToChallenge(challengeId, 'declined')
}

export async function cancelChallengeAction(challengeId: string) {
  return respondToChallenge(challengeId, 'cancelled')
}
