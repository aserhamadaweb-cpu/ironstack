/**
 * Social agent actions.
 *
 * Everything here is `affectsOthers: true` — it either notifies another athlete
 * or changes what they can see. Messaging is deliberately absent: the coach must
 * never be able to write message content in the athlete's name.
 */

import { fetchPublicProfileByUsernameOrId } from '@/lib/data/public-profiles'
import {
  acceptChallengeAction,
  cancelChallengeAction,
  createChallengeAction,
  declineChallengeAction,
} from '@/lib/data/challenges'
import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  followUserAction,
  getFollowStatusAction,
  getFriendshipStatusAction,
  sendFriendRequestAction,
  unfollowUserAction,
  unfriendAction,
} from '@/lib/data/social-actions'
import { createClient } from '@/lib/supabase/server'
import {
  defineAgentAction,
  fail,
  type AgentFailure,
  type AnyAgentAction,
} from '@/lib/ai/agent/types'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value)
  return Number.NaN
}

type Person = { id: string; label: string }

/** Resolve a model-supplied handle to a real profile, refusing self-targeting. */
async function resolvePerson(
  userId: string,
  raw: Record<string, unknown>,
): Promise<{ ok: true; person: Person } | AgentFailure> {
  const handle =
    asString(raw.username) ||
    asString(raw.user_id) ||
    asString(raw.targetId)
  if (!handle) return fail('Who do you mean? Give me their username.')

  const supabase = await createClient()
  const { data } = await fetchPublicProfileByUsernameOrId(supabase, handle)
  if (!data) return fail(`I could not find an athlete called "${handle}".`)
  if (data.id === userId) return fail('That is you.')

  const label = data.display_name
    ? `${data.display_name} (@${data.username ?? data.id})`
    : `@${data.username ?? data.id}`
  return { ok: true, person: { id: data.id, label } }
}

const follow = defineAgentAction<{ targetId: string; label: string }>({
  name: 'follow_user',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFollowStatusAction(resolved.person.id)
    if (status.isFollowing) {
      return fail(`You already follow ${resolved.person.label}.`)
    }

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { isFollowing: false },
      preview: {
        title: `Follow ${resolved.person.label}`,
        changes: [
          `Adds ${resolved.person.label} to who you follow`,
          'They get a notification that you followed them',
          'Their workouts start showing in your feed',
        ],
        warning: 'This notifies another athlete.',
        undoable: true,
        confirmLabel: 'Follow',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await followUserAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not follow that athlete.')
    return {
      ok: true,
      summary: `Followed ${prepared.args.label}`,
      after: { isFollowing: true },
    }
  },
  async undo(_ctx, input) {
    const targetId = asString(input.args.targetId)
    if (!targetId) return fail('Could not work out who to unfollow.')
    const result = await unfollowUserAction(targetId)
    if (!result.ok) return fail(result.error ?? 'Could not unfollow.')
    return { ok: true, summary: 'Unfollowed again', after: { isFollowing: false } }
  },
})

const unfollow = defineAgentAction<{ targetId: string; label: string }>({
  name: 'unfollow_user',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFollowStatusAction(resolved.person.id)
    if (!status.isFollowing) {
      return fail(`You do not follow ${resolved.person.label}.`)
    }

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { isFollowing: true },
      preview: {
        title: `Unfollow ${resolved.person.label}`,
        changes: [
          `Removes ${resolved.person.label} from who you follow`,
          'Their workouts stop showing in your feed',
        ],
        undoable: true,
        confirmLabel: 'Unfollow',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await unfollowUserAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not unfollow that athlete.')
    return {
      ok: true,
      summary: `Unfollowed ${prepared.args.label}`,
      after: { isFollowing: false },
    }
  },
  async undo(_ctx, input) {
    const targetId = asString(input.args.targetId)
    if (!targetId) return fail('Could not work out who to follow again.')
    const result = await followUserAction(targetId)
    if (!result.ok) return fail(result.error ?? 'Could not follow again.')
    return { ok: true, summary: 'Followed again', after: { isFollowing: true } }
  },
})

const sendFriendRequest = defineAgentAction<{ targetId: string; label: string }>({
  name: 'send_friend_request',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFriendshipStatusAction(resolved.person.id)
    if (status.status === 'friends') {
      return fail(`You are already friends with ${resolved.person.label}.`)
    }
    if (status.status === 'outgoing') {
      return fail(`You already have a pending request to ${resolved.person.label}.`)
    }

    const willAutoAccept = status.status === 'incoming'

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { status: status.status },
      preview: {
        title: willAutoAccept
          ? `Accept ${resolved.person.label}'s friend request`
          : `Send a friend request to ${resolved.person.label}`,
        changes: willAutoAccept
          ? [
              `${resolved.person.label} already requested you, so this makes you friends immediately`,
              'They get a notification that you accepted',
            ]
          : [
              `Sends ${resolved.person.label} a friend request`,
              'They get a notification and can accept or decline',
            ],
        warning: 'This notifies another athlete.',
        undoable: true,
        confirmLabel: willAutoAccept ? 'Accept' : 'Send request',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await sendFriendRequestAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not send that request.')
    return {
      ok: true,
      summary: `Sent a friend request to ${prepared.args.label}`,
      after: { status: result.status ?? 'outgoing' },
    }
  },
  async undo(_ctx, input) {
    const targetId = asString(input.args.targetId)
    if (!targetId) return fail('Could not work out whose request to cancel.')
    const after = (input.after as { status?: string } | null)?.status
    const result =
      after === 'friends'
        ? await unfriendAction(targetId)
        : await cancelFriendRequestAction(targetId)
    if (!result.ok) return fail(result.error ?? 'Could not undo that.')
    return {
      ok: true,
      summary: after === 'friends' ? 'Removed the friendship' : 'Cancelled the friend request',
      after: { status: 'none' },
    }
  },
})

const acceptFriendRequest = defineAgentAction<{ targetId: string; label: string }>({
  name: 'accept_friend_request',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFriendshipStatusAction(resolved.person.id)
    if (status.status !== 'incoming') {
      return fail(`There is no pending request from ${resolved.person.label}.`)
    }

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { status: 'incoming' },
      preview: {
        title: `Accept ${resolved.person.label}'s friend request`,
        changes: [
          `Makes you and ${resolved.person.label} friends`,
          'They get a notification that you accepted',
          'Friends can message each other and send challenges',
        ],
        undoable: true,
        confirmLabel: 'Accept',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await acceptFriendRequestAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not accept that request.')
    return {
      ok: true,
      summary: `Accepted the friend request from ${prepared.args.label}`,
      after: { status: 'friends' },
    }
  },
  async undo(_ctx, input) {
    const targetId = asString(input.args.targetId)
    if (!targetId) return fail('Could not work out which friendship to remove.')
    const result = await unfriendAction(targetId)
    if (!result.ok) return fail(result.error ?? 'Could not undo that.')
    return {
      ok: true,
      summary: 'Removed the friendship (the original request is not restored)',
      after: { status: 'none' },
    }
  },
})

const declineFriendRequest = defineAgentAction<{ targetId: string; label: string }>({
  name: 'decline_friend_request',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFriendshipStatusAction(resolved.person.id)
    if (status.status !== 'incoming') {
      return fail(`There is no pending request from ${resolved.person.label}.`)
    }

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { status: 'incoming' },
      preview: {
        title: `Decline ${resolved.person.label}'s friend request`,
        changes: [
          `Removes the pending request from ${resolved.person.label}`,
          'They are not told that you declined',
        ],
        warning:
          'This cannot be undone — they would have to send a new request.',
        undoable: false,
        confirmLabel: 'Decline',
        destructive: true,
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await declineFriendRequestAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not decline that request.')
    return {
      ok: true,
      summary: `Declined the friend request from ${prepared.args.label}`,
      after: { status: 'none' },
    }
  },
})

const cancelFriendRequest = defineAgentAction<{ targetId: string; label: string }>({
  name: 'cancel_friend_request',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFriendshipStatusAction(resolved.person.id)
    if (status.status !== 'outgoing') {
      return fail(`You do not have a pending request to ${resolved.person.label}.`)
    }

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { status: 'outgoing' },
      preview: {
        title: `Cancel your friend request to ${resolved.person.label}`,
        changes: [`Withdraws the pending request to ${resolved.person.label}`],
        undoable: true,
        confirmLabel: 'Cancel request',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await cancelFriendRequestAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not cancel that request.')
    return {
      ok: true,
      summary: `Cancelled the friend request to ${prepared.args.label}`,
      after: { status: 'none' },
    }
  },
  async undo(_ctx, input) {
    const targetId = asString(input.args.targetId)
    if (!targetId) return fail('Could not work out who to re-request.')
    const result = await sendFriendRequestAction(targetId)
    if (!result.ok) return fail(result.error ?? 'Could not resend that request.')
    return { ok: true, summary: 'Resent the friend request', after: { status: 'outgoing' } }
  },
})

const unfriend = defineAgentAction<{ targetId: string; label: string }>({
  name: 'unfriend',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFriendshipStatusAction(resolved.person.id)
    if (status.status !== 'friends') {
      return fail(`You are not friends with ${resolved.person.label}.`)
    }

    return {
      ok: true,
      args: { targetId: resolved.person.id, label: resolved.person.label },
      before: { status: 'friends' },
      preview: {
        title: `Remove ${resolved.person.label} as a friend`,
        changes: [
          `Ends the friendship with ${resolved.person.label}`,
          'You both lose friends-only messaging and challenges',
        ],
        warning:
          'Undo sends a fresh friend request — it does not silently restore the friendship.',
        undoable: true,
        confirmLabel: 'Remove friend',
        destructive: true,
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await unfriendAction(prepared.args.targetId)
    if (!result.ok) return fail(result.error ?? 'Could not remove that friend.')
    return {
      ok: true,
      summary: `Removed ${prepared.args.label} as a friend`,
      after: { status: 'none' },
    }
  },
  async undo(_ctx, input) {
    const targetId = asString(input.args.targetId)
    if (!targetId) return fail('Could not work out who to re-add.')
    const result = await sendFriendRequestAction(targetId)
    if (!result.ok) return fail(result.error ?? 'Could not send a new request.')
    return {
      ok: true,
      summary: 'Sent a new friend request (they need to accept it)',
      after: { status: 'outgoing' },
    }
  },
})

const createChallenge = defineAgentAction<{
  opponentId: string
  label: string
  liftTypeId: string
  liftName: string
  targetWeight: number
  targetReps: number
}>({
  name: 'create_challenge',
  domain: 'social',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const resolved = await resolvePerson(ctx.userId, raw)
    if (!resolved.ok) return resolved

    const status = await getFriendshipStatusAction(resolved.person.id)
    if (status.status !== 'friends') {
      return fail(
        `You can only challenge friends. You are not friends with ${resolved.person.label} yet.`,
      )
    }

    const exerciseName = asString(raw.exercise_name)
    if (!exerciseName) return fail('Which lift should the challenge be on?')

    const targetWeight = asNumber(raw.target_weight)
    const targetReps = asNumber(raw.target_reps)
    if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
      return fail('What target weight should the challenge use?')
    }
    if (!Number.isFinite(targetReps) || targetReps <= 0) {
      return fail('How many reps is the target?')
    }

    const supabase = await createClient()
    const { data: lifts } = await supabase
      .from('lift_types')
      .select('id, name')
      .ilike('name', `%${exerciseName.replace(/[%_]/g, '')}%`)
      .limit(5)

    if (!lifts?.length) {
      return fail(`I could not find a lift called "${exerciseName}".`)
    }
    if (lifts.length > 1) {
      const exact = lifts.find(
        (lift) => lift.name.toLowerCase() === exerciseName.toLowerCase(),
      )
      if (!exact) {
        return fail(
          `Which lift did you mean? ${lifts.map((l) => l.name).join(', ')}.`,
        )
      }
    }
    const lift =
      lifts.find((l) => l.name.toLowerCase() === exerciseName.toLowerCase()) ??
      lifts[0]

    const unit = asString(raw.unit).toLowerCase() === 'lb' ? 'lb' : 'kg'

    return {
      ok: true,
      args: {
        opponentId: resolved.person.id,
        label: resolved.person.label,
        liftTypeId: lift.id,
        liftName: lift.name,
        targetWeight,
        targetReps,
      },
      before: null,
      preview: {
        title: `Challenge ${resolved.person.label} on ${lift.name}`,
        changes: [
          `Target: ${targetWeight} ${unit} x ${targetReps} reps on ${lift.name}`,
          `${resolved.person.label} gets a notification and can accept or decline`,
          'First to hit the target in a logged session wins',
        ],
        warning: 'This notifies another athlete.',
        undoable: true,
        confirmLabel: 'Send challenge',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await createChallengeAction({
      opponentId: prepared.args.opponentId,
      liftTypeId: prepared.args.liftTypeId,
      targetWeight: prepared.args.targetWeight,
      targetReps: prepared.args.targetReps,
    })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Challenged ${prepared.args.label} on ${prepared.args.liftName} (${prepared.args.targetWeight} x ${prepared.args.targetReps})`,
      after: { challengeId: result.id },
      href: '/dashboard/challenges',
    }
  },
  async undo(_ctx, input) {
    const challengeId = asString(
      (input.after as { challengeId?: string } | null)?.challengeId,
    )
    if (!challengeId) return fail('Could not find that challenge to cancel.')
    const result = await cancelChallengeAction(challengeId)
    if (!result.ok) return fail(result.error ?? 'Could not cancel that challenge.')
    return { ok: true, summary: 'Cancelled the challenge', after: null }
  },
})

type ChallengeResponse = 'accept' | 'decline' | 'cancel'

function challengeResponder(
  name: string,
  mode: ChallengeResponse,
): AnyAgentAction {
  return defineAgentAction<{ challengeId: string; label: string }>({
    name,
    domain: 'social',
    affectsOthers: true,
    async prepare(ctx, raw) {
      const challengeId = asString(raw.challenge_id)
      if (!challengeId) return fail('Which challenge do you mean?')

      const supabase = await createClient()
      const { data: challenge } = await supabase
        .from('challenges')
        .select(
          'id, creator_id, opponent_id, status, target_weight, target_reps, lift_types(name)',
        )
        .eq('id', challengeId)
        .maybeSingle()

      if (!challenge) return fail('That challenge was not found.')
      if (
        challenge.creator_id !== ctx.userId &&
        challenge.opponent_id !== ctx.userId
      ) {
        return fail('That challenge is not yours.')
      }
      if (mode === 'cancel' && challenge.creator_id !== ctx.userId) {
        return fail('Only the athlete who created a challenge can cancel it.')
      }
      if (mode !== 'cancel' && challenge.opponent_id !== ctx.userId) {
        return fail('Only the challenged athlete can respond to that one.')
      }
      if (mode !== 'cancel' && challenge.status !== 'pending') {
        return fail(`That challenge is already ${challenge.status}.`)
      }

      const lift = Array.isArray(challenge.lift_types)
        ? challenge.lift_types[0]
        : challenge.lift_types
      const liftName = (lift as { name?: string } | null)?.name ?? 'the lift'
      const label = `${liftName} ${challenge.target_weight} x ${challenge.target_reps}`

      const copy: Record<ChallengeResponse, { title: string; changes: string[]; confirm: string }> = {
        accept: {
          title: `Accept the ${label} challenge`,
          changes: [
            'Activates the challenge for both of you',
            'The other athlete is notified that you accepted',
            'Whoever logs the target first wins',
          ],
          confirm: 'Accept challenge',
        },
        decline: {
          title: `Decline the ${label} challenge`,
          changes: [
            'Turns down the challenge',
            'The other athlete is notified',
          ],
          confirm: 'Decline challenge',
        },
        cancel: {
          title: `Cancel the ${label} challenge`,
          changes: [
            'Withdraws the challenge you created',
            'The other athlete is notified',
          ],
          confirm: 'Cancel challenge',
        },
      }

      return {
        ok: true,
        args: { challengeId, label },
        before: { status: challenge.status },
        preview: {
          title: copy[mode].title,
          changes: copy[mode].changes,
          warning: 'This cannot be undone — a new challenge would have to be sent.',
          undoable: false,
          confirmLabel: copy[mode].confirm,
          destructive: mode !== 'accept',
        },
      }
    },
    async execute(_ctx, prepared) {
      const run =
        mode === 'accept'
          ? acceptChallengeAction
          : mode === 'decline'
            ? declineChallengeAction
            : cancelChallengeAction
      const result = await run(prepared.args.challengeId)
      if (!result.ok) return fail(result.error ?? 'Could not update that challenge.')
      const verb =
        mode === 'accept' ? 'Accepted' : mode === 'decline' ? 'Declined' : 'Cancelled'
      return {
        ok: true,
        summary: `${verb} the ${prepared.args.label} challenge`,
        after: { status: mode === 'accept' ? 'active' : mode === 'decline' ? 'declined' : 'cancelled' },
        href: '/dashboard/challenges',
      }
    },
  })
}

export const SOCIAL_AGENT_ACTIONS: AnyAgentAction[] = [
  follow,
  unfollow,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  unfriend,
  createChallenge,
  challengeResponder('accept_challenge', 'accept'),
  challengeResponder('decline_challenge', 'decline'),
  challengeResponder('cancel_challenge', 'cancel'),
]
