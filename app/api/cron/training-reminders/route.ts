import { NextResponse } from 'next/server'
import type { NotificationPreferences, PushSubscriptionRow } from '@/lib/database.types'
import {
  chooseTrainingReminders,
  REMINDER_TYPES,
  reminderCopy,
  reminderDayKey,
  type ReminderKind,
} from '@/lib/push/training-reminders'
import { sendPushToSubscription } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

const CHUNK = 20

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  return groups
}

type ProfileRow = {
  id: string
  language: string | null
  notification_preferences: Partial<NotificationPreferences> | null
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const admin = createAdminClient()
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth_key')

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 })
  }

  const subscriptions = (subs ?? []) as PushSubscriptionRow[]
  const byUser = new Map<string, PushSubscriptionRow[]>()
  for (const sub of subscriptions) {
    const list = byUser.get(sub.user_id) ?? []
    list.push(sub)
    byUser.set(sub.user_id, list)
  }
  const userIds = [...byUser.keys()]
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, users: 0, sent: 0 })
  }

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, language, notification_preferences')
    .in('id', userIds)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const profileById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  )

  const since = new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentRows, error: recentError } = await admin
    .from('notifications')
    .select('user_id, type, created_at')
    .in('user_id', userIds)
    .in('type', REMINDER_TYPES)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 500 })
  }

  const recentByUser = new Map<string, { type: string; createdAt: string }[]>()
  for (const row of recentRows ?? []) {
    const userId = row.user_id as string
    const list = recentByUser.get(userId) ?? []
    list.push({ type: row.type as string, createdAt: row.created_at as string })
    recentByUser.set(userId, list)
  }

  const lastFinished = new Map<string, string>()
  const openStarted = new Map<string, string>()
  const sessionsThisWeek = new Map<string, number>()
  const trainedToday = new Set<string>()
  const challengeCount = new Map<string, number>()
  const todayKey = reminderDayKey(now)
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  for (const ids of chunk(userIds, CHUNK)) {
    const [done, open, pending, activeAsCreator, activeAsOpponent] = await Promise.all([
      admin
        .from('sessions')
        .select('user_id, finished_at, started_at')
        .in('user_id', ids)
        .eq('status', 'completed')
        .order('finished_at', { ascending: false })
        .limit(1000),
      admin
        .from('sessions')
        .select('user_id, started_at')
        .in('user_id', ids)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(200),
      admin
        .from('challenges')
        .select('opponent_id')
        .in('opponent_id', ids)
        .eq('status', 'pending'),
      admin
        .from('challenges')
        .select('creator_id')
        .in('creator_id', ids)
        .eq('status', 'active'),
      admin
        .from('challenges')
        .select('opponent_id')
        .in('opponent_id', ids)
        .eq('status', 'active'),
    ])
    if (done.error) {
      return NextResponse.json({ error: done.error.message }, { status: 500 })
    }
    if (open.error) {
      return NextResponse.json({ error: open.error.message }, { status: 500 })
    }
    if (pending.error || activeAsCreator.error || activeAsOpponent.error) {
      return NextResponse.json(
        {
          error:
            pending.error?.message ||
            activeAsCreator.error?.message ||
            activeAsOpponent.error?.message,
        },
        { status: 500 },
      )
    }
    for (const row of done.data ?? []) {
      const userId = row.user_id as string
      const finished = (row.finished_at as string | null) ?? (row.started_at as string)
      if (!lastFinished.has(userId)) lastFinished.set(userId, finished)
      const at = new Date(finished).getTime()
      if (Number.isFinite(at) && at >= weekAgo) {
        sessionsThisWeek.set(userId, (sessionsThisWeek.get(userId) ?? 0) + 1)
      }
      if (Number.isFinite(at) && reminderDayKey(at) === todayKey) {
        trainedToday.add(userId)
      }
    }
    for (const row of open.data ?? []) {
      const userId = row.user_id as string
      if (!openStarted.has(userId)) openStarted.set(userId, row.started_at as string)
    }
    const finishedTruncated = (done.data?.length ?? 0) >= 1000
    const openTruncated = (open.data?.length ?? 0) >= 200
    const missingFinished = finishedTruncated
      ? ids.filter((id) => !lastFinished.has(id))
      : []
    const missingOpen = openTruncated
      ? ids.filter((id) => !openStarted.has(id))
      : []
    const backfill = await Promise.all([
      ...missingFinished.map(async (userId) => {
        const latest = await admin
          .from('sessions')
          .select('finished_at, started_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return { userId, latest, open: null }
      }),
      ...missingOpen.map(async (userId) => {
        const openRow = await admin
          .from('sessions')
          .select('started_at')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return { userId, latest: null, open: openRow }
      }),
    ])
    for (const row of backfill) {
      if (row.latest?.error) {
        return NextResponse.json({ error: row.latest.error.message }, { status: 500 })
      }
      if (row.open?.error) {
        return NextResponse.json({ error: row.open.error.message }, { status: 500 })
      }
      const finished =
        (row.latest?.data?.finished_at as string | null) ??
        (row.latest?.data?.started_at as string | null)
      if (finished) lastFinished.set(row.userId, finished)
      const started = row.open?.data?.started_at as string | undefined
      if (started) openStarted.set(row.userId, started)
    }
    const bump = (userId: string) => {
      challengeCount.set(userId, (challengeCount.get(userId) ?? 0) + 1)
    }
    for (const row of pending.data ?? []) bump(row.opponent_id as string)
    for (const row of activeAsCreator.data ?? []) bump(row.creator_id as string)
    for (const row of activeAsOpponent.data ?? []) bump(row.opponent_id as string)
  }

  const streakByUser = new Map<string, { streakDays: number; hoursLeft: number | null }>()
  for (const ids of chunk(userIds, CHUNK)) {
    await Promise.all(
      ids.map(async (userId) => {
        const [streakRes, hoursRes] = await Promise.all([
          admin.rpc('get_current_streak', { p_user_id: userId }),
          admin.rpc('get_streak_hours_left', { p_user_id: userId }),
        ])
        const streakDays = Math.max(0, Math.floor(Number(streakRes.data) || 0))
        const rawHours = Number(hoursRes.data)
        streakByUser.set(userId, {
          streakDays,
          hoursLeft: Number.isFinite(rawHours) ? rawHours : null,
        })
      }),
    )
  }

  let sent = 0
  let pushed = 0
  const removed: string[] = []

  for (const userId of userIds) {
    const profile = profileById.get(userId)
    if (!profile) continue
    const streak = streakByUser.get(userId) ?? { streakDays: 0, hoursLeft: null }
    const language = profile.language === 'ar' ? 'ar' : 'en'
    const kinds = chooseTrainingReminders({
      now,
      language,
      prefs: profile.notification_preferences,
      streakDays: streak.streakDays,
      hoursLeft: streak.hoursLeft,
      lastFinishedAt: lastFinished.get(userId) ?? null,
      openSessionStartedAt: openStarted.get(userId) ?? null,
      trainedToday: trainedToday.has(userId),
      sessionsThisWeek: sessionsThisWeek.get(userId) ?? 0,
      challengeCount: challengeCount.get(userId) ?? 0,
      recent: recentByUser.get(userId) ?? [],
    })
    const quietDays = (() => {
      const iso = lastFinished.get(userId)
      if (!iso) return null
      const at = new Date(iso).getTime()
      if (!Number.isFinite(at)) return null
      return (now - at) / (24 * 60 * 60 * 1000)
    })()

    for (const kind of kinds) {
      const copy = reminderCopy(kind, language, {
        streakDays: streak.streakDays,
        hoursLeft: streak.hoursLeft,
        quietDays,
        sessionsThisWeek: sessionsThisWeek.get(userId) ?? 0,
        challengeCount: challengeCount.get(userId) ?? 0,
      })
      const inserted = await admin.from('notifications').insert({
        user_id: userId,
        type: kind satisfies ReminderKind,
        title: copy.title,
        body: copy.body,
        link: copy.link,
      })
      if (inserted.error) continue
      sent += 1

      const devices = byUser.get(userId) ?? []
      await Promise.all(
        devices.map(async (sub) => {
          const result = await sendPushToSubscription(sub, copy)
          if (result.ok) pushed += 1
          if (result.gone) removed.push(sub.endpoint)
        }),
      )
    }
  }

  if (removed.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', removed)
  }

  return NextResponse.json({
    ok: true,
    users: userIds.length,
    notifications: sent,
    pushed,
    removed: removed.length,
  })
}
