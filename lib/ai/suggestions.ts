/**
 * Proactive coach suggestions.
 *
 * Rules are deterministic heuristics over the athlete's own data — no model
 * call. That keeps them cheap enough to refresh on a page load, predictable
 * enough to test, and impossible to hallucinate.
 *
 * A suggestion is only ever a nudge. It carries a `prompt` that gets typed into
 * the chat for the athlete; acting on one goes through the same
 * propose -> confirm -> audit path as anything they ask for directly. Nothing
 * here can change data.
 */

import { logServerError } from '@/lib/log'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CoachSuggestion = {
  id: string
  kind: string
  title: string
  body: string
  /** Pre-filled chat message. Sending it is still just a request. */
  prompt: string | null
  ctaHref: string | null
  status: 'new' | 'seen' | 'dismissed' | 'acted'
  createdAt: string
}

type Candidate = {
  kind: string
  dedupeKey: string
  title: string
  body: string
  prompt: string | null
  ctaHref: string | null
  priority: number
  /** Suggestions go stale — a nudge about a 3-day gap is wrong a month later. */
  ttlDays: number
}

/** How many live suggestions an athlete may have at once. */
const MAX_ACTIVE = 3

/** Don't re-run the rules more than this often. */
const REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  return Math.floor((Date.now() - then) / DAY_MS)
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type SuggestionContext = {
  splitCount: number
  sharedSplitCount: number
  lastSessionAt: string | null
  sessionCount: number
  staleActiveSessionAt: string | null
  lastBodyWeightAt: string | null
  bodyWeightCount: number
  hasHeight: boolean
  hasBio: boolean
  hasAvatar: boolean
  noteCount: number
  friendCount: number
  incomingFriendRequests: number
  challengeCount: number
  lastPrAt: string | null
  prCount: number
}

async function loadContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<SuggestionContext> {
  const staleCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

  const [
    splits,
    sessions,
    activeSession,
    bodyWeights,
    profile,
    notes,
    friends,
    incoming,
    challenges,
    prs,
    sessionCount,
    bodyWeightCount,
    prCount,
  ] = await Promise.all([
    supabase.from('splits').select('id, is_shared').eq('user_id', userId).eq('is_system', false),
    supabase
      .from('sessions')
      .select('finished_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1),
    supabase
      .from('sessions')
      .select('started_at')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .lt('started_at', staleCutoff)
      .order('started_at', { ascending: false })
      .limit(1),
    supabase
      .from('body_weight_logs')
      .select('logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1),
    supabase
      .from('profiles')
      .select('height_cm, bio, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('ai_user_memory')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true),
    // Friendship rows are directional (user_id = requester), so an accepted
    // friendship can sit on either side.
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'pending'),
    supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`),
    supabase
      .from('personal_records')
      .select('logged_at')
      .eq('user_id', userId)
      .eq('is_current_pr', true)
      .order('logged_at', { ascending: false })
      .limit(1),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
    supabase
      .from('body_weight_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('personal_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_current_pr', true),
  ])

  const splitRows = splits.data ?? []

  return {
    splitCount: splitRows.length,
    sharedSplitCount: splitRows.filter((row) => row.is_shared).length,
    lastSessionAt: sessions.data?.[0]?.finished_at ?? null,
    sessionCount: sessionCount.count ?? 0,
    staleActiveSessionAt: activeSession.data?.[0]?.started_at ?? null,
    lastBodyWeightAt: bodyWeights.data?.[0]?.logged_at ?? null,
    bodyWeightCount: bodyWeightCount.count ?? 0,
    hasHeight: Boolean(profile.data?.height_cm),
    hasBio: Boolean(profile.data?.bio?.trim()),
    hasAvatar: Boolean(profile.data?.avatar_url),
    noteCount: notes.count ?? 0,
    friendCount: friends.count ?? 0,
    incomingFriendRequests: incoming.count ?? 0,
    challengeCount: challenges.count ?? 0,
    lastPrAt: prs.data?.[0]?.logged_at ?? null,
    prCount: prCount.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * Higher priority wins when more than MAX_ACTIVE fire. Ordering reflects how
 * time-sensitive the nudge is, not how impressive it looks.
 */
function buildCandidates(ctx: SuggestionContext): Candidate[] {
  const out: Candidate[] = []
  const sinceSession = daysSince(ctx.lastSessionAt)
  const sinceWeight = daysSince(ctx.lastBodyWeightAt)
  const sincePr = daysSince(ctx.lastPrAt)

  if (ctx.staleActiveSessionAt) {
    out.push({
      kind: 'stale_session',
      dedupeKey: `stale_session:${ctx.staleActiveSessionAt}`,
      title: 'You left a workout open',
      body: 'A session from more than 12 hours ago is still running. Finishing or clearing it keeps your volume and streak accurate.',
      prompt: 'I left a workout session open — what should I do with it?',
      ctaHref: '/dashboard/workout',
      priority: 90,
      ttlDays: 3,
    })
  }

  if (ctx.incomingFriendRequests > 0) {
    out.push({
      kind: 'friend_requests',
      dedupeKey: `friend_requests:${ctx.incomingFriendRequests}`,
      title:
        ctx.incomingFriendRequests === 1
          ? 'You have a friend request waiting'
          : `You have ${ctx.incomingFriendRequests} friend requests waiting`,
      body: 'I can accept or decline them for you — just say which.',
      prompt: 'Show me my pending friend requests.',
      ctaHref: '/dashboard/community',
      priority: 70,
      ttlDays: 7,
    })
  }

  if (ctx.splitCount === 0) {
    out.push({
      kind: 'no_split',
      dedupeKey: 'no_split',
      title: 'No split saved yet',
      body: "Tell me how many days a week you can train and what equipment you have, and I'll build one you can save in a tap.",
      prompt: 'Build me a split based on my best exercises.',
      ctaHref: '/dashboard/splits',
      priority: 85,
      ttlDays: 14,
    })
  } else if (sinceSession === null && ctx.sessionCount === 0) {
    out.push({
      kind: 'never_trained',
      dedupeKey: 'never_trained',
      title: 'Your split is waiting on you',
      body: "You've got a split saved but no logged sessions yet. The first one is the hard one.",
      prompt: 'Walk me through starting my first workout.',
      ctaHref: '/dashboard/workout',
      priority: 80,
      ttlDays: 14,
    })
  } else if (sinceSession !== null && sinceSession >= 7) {
    out.push({
      kind: 'training_gap',
      dedupeKey: `training_gap:${Math.min(sinceSession, 60)}`,
      title: `${sinceSession} days since your last session`,
      body: "Want me to scale this week down so coming back doesn't wreck you? I can also just tell you where you left off.",
      prompt: `I haven't trained in ${sinceSession} days. How should I come back?`,
      ctaHref: '/dashboard/workout',
      priority: 75,
      ttlDays: 5,
    })
  }

  if (ctx.bodyWeightCount === 0) {
    out.push({
      kind: 'no_body_weight',
      dedupeKey: 'no_body_weight',
      title: 'Never logged your body weight',
      body: 'One number lets me read strength gains properly instead of guessing. Tell me your weight and I\'ll log it.',
      prompt: 'Log my body weight.',
      ctaHref: '/dashboard/profile',
      priority: 45,
      ttlDays: 30,
    })
  } else if (sinceWeight !== null && sinceWeight >= 21) {
    out.push({
      kind: 'body_weight_gap',
      dedupeKey: `body_weight_gap:${Math.min(sinceWeight, 120)}`,
      title: `Last weigh-in was ${sinceWeight} days ago`,
      body: 'Give me a fresh number and I\'ll log it, then we can see whether your strength is tracking with it.',
      prompt: 'Log my body weight.',
      ctaHref: '/dashboard/profile',
      priority: 40,
      ttlDays: 14,
    })
  }

  if (ctx.sessionCount >= 3 && ctx.noteCount === 0) {
    out.push({
      kind: 'no_notes',
      dedupeKey: 'no_notes',
      title: "I don't know your constraints yet",
      body: 'Injuries, dodgy joints, equipment you actually have, a goal date — tell me once and I\'ll remember it for every plan.',
      prompt: 'Here are some things you should remember about my training:',
      ctaHref: null,
      priority: 55,
      ttlDays: 30,
    })
  }

  if (ctx.prCount >= 3 && sincePr !== null && sincePr >= 45) {
    out.push({
      kind: 'pr_stale',
      dedupeKey: `pr_stale:${Math.min(sincePr, 180)}`,
      title: `No new PR in ${sincePr} days`,
      body: "That's usually a programming problem, not an effort problem. I can look at your logs and pick one lift to push.",
      prompt: 'My PRs have stalled. Which lift should I focus on?',
      ctaHref: '/dashboard/records',
      priority: 60,
      ttlDays: 21,
    })
  }

  if (ctx.sessionCount >= 5 && ctx.friendCount === 0) {
    out.push({
      kind: 'no_friends',
      dedupeKey: 'no_friends',
      title: 'Training alone in here',
      body: 'Adding a friend unlocks challenges and the leaderboard. I can send a request if you give me their username.',
      prompt: 'How do challenges work?',
      ctaHref: '/dashboard/community',
      priority: 30,
      ttlDays: 30,
    })
  } else if (ctx.friendCount > 0 && ctx.challengeCount === 0) {
    out.push({
      kind: 'no_challenges',
      dedupeKey: 'no_challenges',
      title: "You've never run a challenge",
      body: 'Pick a friend and a lift and I\'ll set up the challenge for you to confirm.',
      prompt: 'Challenge one of my friends on a lift.',
      ctaHref: '/dashboard/challenges',
      priority: 25,
      ttlDays: 45,
    })
  }

  if (ctx.splitCount >= 2 && ctx.sharedSplitCount === 0 && ctx.sessionCount >= 5) {
    out.push({
      kind: 'never_shared',
      dedupeKey: 'never_shared',
      title: 'Your splits are all private',
      body: 'Sharing one puts it in the community library. I can flip a split to public whenever you want.',
      prompt: 'Share one of my splits publicly.',
      ctaHref: '/dashboard/splits',
      priority: 15,
      ttlDays: 60,
    })
  }

  if (!ctx.hasAvatar || !ctx.hasBio || !ctx.hasHeight) {
    const missing = [
      !ctx.hasAvatar ? 'a picture' : null,
      !ctx.hasBio ? 'a bio' : null,
      !ctx.hasHeight ? 'your height' : null,
    ].filter(Boolean) as string[]
    out.push({
      kind: 'profile_incomplete',
      dedupeKey: `profile_incomplete:${missing.join('+')}`,
      title: 'Your profile is missing a few things',
      body: `No ${missing.join(', no ')} yet. Tell me what to put and I'll fill it in for you to confirm.`,
      prompt: 'Help me finish setting up my profile.',
      ctaHref: '/dashboard/profile',
      priority: 20,
      ttlDays: 30,
    })
  }

  return out.sort((a, b) => b.priority - a.priority)
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

type SuggestionRow = {
  id: string
  kind: string
  title: string
  body: string
  prompt: string | null
  cta_href: string | null
  status: string
  created_at: string
}

function toSuggestion(row: SuggestionRow): CoachSuggestion {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    prompt: row.prompt,
    ctaHref: row.cta_href,
    status: row.status as CoachSuggestion['status'],
    createdAt: row.created_at,
  }
}

const LIVE_STATUSES = ['new', 'seen']

/** Read live suggestions without running the rules. Safe on any render path. */
export async function listLiveSuggestions(
  userId: string,
): Promise<CoachSuggestion[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ai_suggestions')
      .select('id, kind, title, body, prompt, cta_href, status, created_at')
      .eq('user_id', userId)
      .in('status', LIVE_STATUSES)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(MAX_ACTIVE)

    if (error) {
      logServerError('[ai_suggestions list]', error.message)
      return []
    }
    return (data ?? []).map((row) => toSuggestion(row as SuggestionRow))
  } catch (err) {
    logServerError('[ai_suggestions list]', err)
    return []
  }
}

export async function countNewSuggestions(userId: string): Promise<number> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('ai_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'new')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/**
 * Expire suggestions that outlived their TTL, then insert any newly-firing
 * rules up to MAX_ACTIVE.
 *
 * Dedupe is enforced by the `(user_id, dedupe_key)` unique constraint rather
 * than a read-then-write check, so concurrent refreshes cannot double-insert.
 * A key the athlete already dismissed stays dismissed — the insert conflicts
 * and is ignored.
 */
export async function refreshSuggestions(
  userId: string,
  options?: { force?: boolean },
): Promise<CoachSuggestion[]> {
  try {
    const supabase = await createClient()
    const nowIso = new Date().toISOString()

    await supabase
      .from('ai_suggestions')
      .update({ status: 'dismissed', resolved_at: nowIso })
      .eq('user_id', userId)
      .in('status', LIVE_STATUSES)
      .not('expires_at', 'is', null)
      .lt('expires_at', nowIso)

    const [{ data: existing }, { data: lastWritten }] = await Promise.all([
      supabase
        .from('ai_suggestions')
        .select('id, kind, title, body, prompt, cta_href, status, created_at')
        .eq('user_id', userId)
        .in('status', LIVE_STATUSES)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_suggestions')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const live = (existing ?? []).map((row) => toSuggestion(row as SuggestionRow))

    if (!options?.force) {
      if (live.length >= MAX_ACTIVE) return live.slice(0, MAX_ACTIVE)
      // Cooldown keyed on the last row written for ANY status. Without this an
      // athlete who dismissed everything would re-run the whole rule set on
      // every page load.
      const lastAt = lastWritten?.[0]?.created_at
      if (lastAt && Date.now() - new Date(lastAt).getTime() < REFRESH_COOLDOWN_MS) {
        return live.slice(0, MAX_ACTIVE)
      }
    }

    const slots = MAX_ACTIVE - live.length
    if (slots <= 0) return live.slice(0, MAX_ACTIVE)

    const ctx = await loadContext(supabase, userId)
    const candidates = buildCandidates(ctx)
    const liveKinds = new Set(live.map((item) => item.kind))

    const rows = candidates
      .filter((candidate) => !liveKinds.has(candidate.kind))
      .slice(0, slots)
      .map((candidate) => ({
        user_id: userId,
        kind: candidate.kind,
        dedupe_key: candidate.dedupeKey,
        title: candidate.title,
        body: candidate.body,
        prompt: candidate.prompt,
        cta_href: candidate.ctaHref,
        priority: candidate.priority,
        status: 'new',
        expires_at: new Date(Date.now() + candidate.ttlDays * DAY_MS).toISOString(),
      }))

    if (rows.length > 0) {
      const { error } = await supabase
        .from('ai_suggestions')
        .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      if (error) logServerError('[ai_suggestions insert]', error.message)
    }

    return listLiveSuggestions(userId)
  } catch (err) {
    logServerError('[ai_suggestions refresh]', err)
    return []
  }
}

/** Flip `new` -> `seen` so the badge clears once the athlete has looked. */
export async function markSuggestionsSeen(userId: string): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase
      .from('ai_suggestions')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'new')
  } catch (err) {
    logServerError('[ai_suggestions seen]', err)
  }
}

export async function resolveSuggestion(
  userId: string,
  suggestionId: string,
  status: 'dismissed' | 'acted',
): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('ai_suggestions')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', suggestionId)
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

/** Exported for the boundary test — proves no rule can mutate athlete data. */
export const __suggestionRulesForTest = buildCandidates
