'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { encodeSplitShareMessage, type SplitSharePayload } from '@/lib/split-share-message'
import { splitShareAbsoluteUrl } from '@/lib/split-share-url'
import { countExercises, type SplitDetail } from '@/lib/split-data'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { formatTargetReps } from '@/lib/split-reps'
import { listGroupChatsForUser } from '@/lib/data/group-chats'
import {
  areFriends,
  findOrCreateDmThread,
  getThreadForUser,
  listDmThreads,
} from '@/lib/data/social'
import { sendDmMessageAction } from '@/lib/data/social-actions'
import { sendGroupMessageAction } from '@/lib/data/group-chats'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import type { SplitDetailRow } from '@/lib/database.types'

const SPLIT_SELECT = `
  id, user_id, name, description, days_per_week, category, is_system, is_shared, share_token,
  split_days (
    id, name, subtitle, day_order,
    split_day_exercises (
      id, lift_type_id, target_sets, target_reps_min, target_reps_max, exercise_order,
      lift_types ( id, name, category )
    )
  )
`

export type ShareConversationTarget = {
  id: string
  kind: 'dm' | 'group'
  label: string
  subtitle: string
  avatarUrl: string | null
  username: string | null
  threadId: string | null
  otherUserId: string | null
  groupId: string | null
  canSend: boolean
  blockReason: string | null
}

export type PublicSharedSplitOwner = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export type PublicSharedSplitExercise = {
  id: string
  name: string
  sets: number
  reps: string
}

export type PublicSharedSplitDay = {
  id: string
  name: string
  subtitle: string | null
  exercises: PublicSharedSplitExercise[]
}

export type PublicSharedSplitView = {
  id: string
  shareToken: string
  name: string
  description: string | null
  daysPerWeek: number
  category: string | null
  exerciseCount: number
  owner: PublicSharedSplitOwner
  schedule: PublicSharedSplitDay[]
}

function generateShareToken(): string {
  return randomBytes(12).toString('base64url')
}

function dmBlockedReason(input: {
  status: 'pending' | 'accepted'
  initiatedBy: string
  userId: string
  isFriend: boolean
  lastSenderId: string | null
  otherLabel: string
}): string | null {
  if (input.status !== 'pending' || input.isFriend) return null
  if (input.initiatedBy !== input.userId) return null
  if (!input.lastSenderId || input.lastSenderId !== input.userId) return null
  return `Waiting for a reply from ${input.otherLabel} before you can send another message.`
}

function adaptPublicSplitRow(
  row: SplitDetailRow,
  owner: PublicSharedSplitOwner,
): PublicSharedSplitView {
  const schedule = [...(row.split_days ?? [])]
    .sort((a, b) => a.day_order - b.day_order)
    .map((day) => ({
      id: day.id,
      name: day.name,
      subtitle: day.subtitle,
      exercises: [...(day.split_day_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .map((exercise) => ({
          id: exercise.id,
          name: exercise.lift_types?.name ?? 'Exercise',
          sets: exercise.target_sets,
          reps: formatTargetReps(
            exercise.target_reps_min,
            exercise.target_reps_max,
            exercise.lift_types?.category === 'cardio' ? '30' : '8–12',
          ),
        })),
    }))

  const exerciseCount = schedule.reduce(
    (sum, day) => sum + day.exercises.length,
    0,
  )

  return {
    id: row.id,
    shareToken: row.share_token as string,
    name: row.name,
    description: row.description,
    daysPerWeek: row.days_per_week,
    category: row.category,
    exerciseCount,
    owner,
    schedule,
  }
}

/** Ensures a custom split has a share token and is marked shared for import. Owner-only. */
export async function ensureSplitShareReady(splitId: string): Promise<
  | {
      ok: true
      shareToken: string
      shareUrl: string
      payload: SplitSharePayload
    }
  | { ok: false; error: string }
> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const id = splitId.trim()
  if (!id) return { ok: false, error: 'Missing split id.' }

  const { data: existing, error: loadError } = await supabase
    .from('splits')
    .select(
      'id, user_id, is_system, name, days_per_week, category, is_shared, split_days ( split_day_exercises ( id ) )',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadError) {
    console.error('[ensureSplitShareReady] load', loadError)
    const msg = loadError.message.toLowerCase()
    if (msg.includes('share_token') || msg.includes('column')) {
      return {
        ok: false,
        error:
          'Split link sharing is not set up yet — run supabase/add-split-share-token.sql in the Supabase SQL Editor.',
      }
    }
    return { ok: false, error: 'Could not load that split. Please try again.' }
  }
  if (!existing) {
    return { ok: false, error: 'Could not find that split.' }
  }
  if (existing.is_system) {
    return { ok: false, error: 'Only your custom splits can be shared.' }
  }

  // Re-use an existing token when the column is present; otherwise mint a new one.
  let shareToken = generateShareToken()
  const { data: tokenRow, error: tokenError } = await supabase
    .from('splits')
    .select('share_token')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (tokenError) {
    const msg = tokenError.message.toLowerCase()
    if (msg.includes('share_token') || msg.includes('column')) {
      return {
        ok: false,
        error:
          'Split link sharing is not set up yet — run supabase/add-split-share-token.sql in the Supabase SQL Editor.',
      }
    }
  } else {
    const existingToken = (tokenRow?.share_token as string | null)?.trim()
    if (existingToken) shareToken = existingToken
  }

  const { error: updateError } = await supabase
    .from('splits')
    .update({
      share_token: shareToken,
      is_shared: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    const msg = updateError.message.toLowerCase()
    if (msg.includes('share_token') || msg.includes('column')) {
      return {
        ok: false,
        error:
          'Split link sharing is not set up yet — run supabase/add-split-share-token.sql in the Supabase SQL Editor.',
      }
    }
    return { ok: false, error: 'Could not prepare this split for sharing.' }
  }

  const exerciseCount = (
    Array.isArray(existing.split_days) ? existing.split_days : []
  ).reduce(
    (sum, day) =>
      sum +
      (Array.isArray(day.split_day_exercises)
        ? day.split_day_exercises.length
        : 0),
    0,
  )

  const payload: SplitSharePayload = {
    v: 1,
    splitId: id,
    shareToken,
    name: existing.name as string,
    daysPerWeek: Number(existing.days_per_week) || 3,
    category: (existing.category as string | null) ?? null,
    exerciseCount,
  }

  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/splits')
  revalidatePath(`/dashboard/splits/${id}`)

  return {
    ok: true,
    shareToken,
    shareUrl: splitShareAbsoluteUrl(shareToken),
    payload,
  }
}

/** Service-role read for anonymous public share pages. */
export async function getPublicSharedSplitByToken(
  token: string,
): Promise<PublicSharedSplitView | null> {
  const trimmed = token.trim()
  if (!trimmed) return null

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return null
  }

  const { data: row, error } = await admin
    .from('splits')
    .select(SPLIT_SELECT)
    .eq('share_token', trimmed)
    .eq('is_system', false)
    .not('user_id', 'is', null)
    .maybeSingle()

  if (error || !row) return null

  const ownerId = row.user_id as string
  const { data: ownerRow } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', ownerId)
    .maybeSingle()

  if (!ownerRow) return null

  const detail = row as unknown as SplitDetailRow & { share_token: string }
  detail.split_days = [...(detail.split_days ?? [])]
  return adaptPublicSplitRow(detail, {
    id: ownerRow.id,
    username: ownerRow.username,
    display_name: ownerRow.display_name,
    avatar_url: ownerRow.avatar_url,
  })
}

export async function listShareConversationTargetsAction(): Promise<{
  targets: ShareConversationTarget[]
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { targets: [], error: 'Not signed in.' }

  const [threads, groups] = await Promise.all([
    listDmThreads(user.id),
    listGroupChatsForUser(user.id),
  ])

  const targets: ShareConversationTarget[] = []

  for (const item of threads) {
    const label =
      item.other.display_name || item.other.username || 'Athlete'
    let canSend = true
    let blockReason: string | null = null
    const threadId = item.thread?.id ?? null

    if (item.thread) {
      const friend = await areFriends(user.id, item.other.id)
      const blocked = dmBlockedReason({
        status: item.thread.status,
        initiatedBy: item.thread.initiated_by,
        userId: user.id,
        isFriend: friend,
        lastSenderId: item.lastMessage?.sender_id ?? null,
        otherLabel: label,
      })
      if (blocked) {
        canSend = false
        blockReason = blocked
      }
    }

    targets.push({
      id: `dm:${item.other.id}`,
      kind: 'dm',
      label,
      subtitle: item.thread ? 'Direct message' : 'Friend · new chat',
      avatarUrl: item.other.avatar_url,
      username: item.other.username,
      threadId,
      otherUserId: item.other.id,
      groupId: null,
      canSend,
      blockReason,
    })
  }

  for (const group of groups) {
    targets.push({
      id: `group:${group.chat.id}`,
      kind: 'group',
      label: group.chat.name,
      subtitle: group.chat.is_global
        ? 'Community chat'
        : `${group.memberCount} members`,
      avatarUrl: group.chat.avatar_url,
      username: null,
      threadId: null,
      otherUserId: null,
      groupId: group.chat.id,
      canSend: true,
      blockReason: null,
    })
  }

  targets.sort((a, b) => a.label.localeCompare(b.label))
  return { targets }
}

export type ShareSplitTargetInput =
  | { kind: 'dm'; otherUserId: string; threadId?: string | null }
  | { kind: 'group'; groupId: string }

export async function shareSplitToTargetsAction(input: {
  splitId: string
  note?: string
  targets: ShareSplitTargetInput[]
}): Promise<{
  ok: boolean
  shareUrl?: string
  results: Array<{ targetId: string; label: string; ok: boolean; error?: string }>
  error?: string
}> {
  const ready = await ensureSplitShareReady(input.splitId)
  if (!ready.ok) {
    return { ok: false, results: [], error: ready.error }
  }

  const payload: SplitSharePayload = {
    ...ready.payload,
    note: input.note?.trim() || undefined,
  }
  const content = encodeSplitShareMessage(payload)
  if (content.length > 2000) {
    return {
      ok: false,
      results: [],
      error: 'That note is too long to send with this split.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, results: [], error: 'Not signed in.' }

  const list = await listShareConversationTargetsAction()
  const targetMap = new Map(list.targets.map((t) => [t.id, t]))

  const results: Array<{
    targetId: string
    label: string
    ok: boolean
    error?: string
  }> = []

  for (const target of input.targets) {
    const targetId =
      target.kind === 'dm'
        ? `dm:${target.otherUserId}`
        : `group:${target.groupId}`
    const meta = targetMap.get(targetId)
    const label = meta?.label ?? 'Conversation'

    if (meta && !meta.canSend) {
      results.push({
        targetId,
        label,
        ok: false,
        error: meta.blockReason ?? 'Cannot send to this conversation.',
      })
      continue
    }

    if (target.kind === 'group') {
      const result = await sendGroupMessageAction({
        groupId: target.groupId,
        content,
      })
      results.push({
        targetId,
        label,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
      })
      continue
    }

    let threadId = target.threadId?.trim() || meta?.threadId || ''
    if (!threadId) {
      const created = await findOrCreateDmThread(user.id, target.otherUserId)
      if (created.error || !created.threadId) {
        results.push({
          targetId,
          label,
          ok: false,
          error: created.error ?? 'Could not start chat.',
        })
        continue
      }
      threadId = created.threadId
    }

    const threadBundle = await getThreadForUser(threadId, user.id)
    if (!threadBundle) {
      results.push({
        targetId,
        label,
        ok: false,
        error: 'Conversation not found.',
      })
      continue
    }

    const blocked = dmBlockedReason({
      status: threadBundle.thread.status,
      initiatedBy: threadBundle.thread.initiated_by ?? user.id,
      userId: user.id,
      isFriend: threadBundle.isFriend,
      lastSenderId:
        threadBundle.messages.at(-1)?.sender_id ??
        null,
      otherLabel: label,
    })
    if (blocked) {
      results.push({ targetId, label, ok: false, error: blocked })
      continue
    }

    const result = await sendDmMessageAction({ threadId, content })
    results.push({
      targetId,
      label,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
    })
  }

  revalidatePath('/dashboard/messages')
  return {
    ok: results.some((r) => r.ok),
    shareUrl: ready.shareUrl,
    results,
  }
}

/** Loads owner split detail for the share sheet header (client-safe fields only). */
export async function getOwnerSplitShareSummaryAction(splitId: string): Promise<
  | { ok: true; split: Pick<SplitDetail, 'slug' | 'name' | 'tag' | 'daysPerWeek'> & { exerciseCount: number } }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('splits')
    .select(SPLIT_SELECT)
    .eq('id', splitId.trim())
    .eq('user_id', user.id)
    .eq('is_system', false)
    .maybeSingle()

  if (error || !data) return { ok: false, error: 'Split not found.' }

  const detail = toSplitDetail(data as unknown as SplitDetailRow)
  return {
    ok: true,
    split: {
      slug: detail.slug,
      name: detail.name,
      tag: detail.tag,
      daysPerWeek: detail.daysPerWeek,
      exerciseCount: countExercises(detail),
    },
  }
}

export async function checkSavedSharedSplitAction(input: {
  splitId: string
  shareToken?: string
}): Promise<{ saved: boolean; owned: boolean; savedCopyId?: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { saved: false, owned: false }

  const { data: source } = await supabase
    .from('splits')
    .select('id, user_id, share_token')
    .eq('id', input.splitId.trim())
    .maybeSingle()

  if (!source) return { saved: false, owned: false }
  if (source.user_id === user.id) {
    return { saved: true, owned: true, savedCopyId: source.id as string }
  }

  if (
    input.shareToken &&
    source.share_token &&
    source.share_token !== input.shareToken.trim()
  ) {
    return { saved: false, owned: false }
  }

  const { data: copy } = await supabase
    .from('splits')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_split_id', source.id)
    .maybeSingle()

  return {
    saved: Boolean(copy?.id),
    owned: false,
    savedCopyId: (copy?.id as string | undefined) ?? null,
  }
}
