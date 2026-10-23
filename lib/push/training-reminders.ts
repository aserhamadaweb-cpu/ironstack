import type { NotificationPreferences } from '@/lib/database.types'

export type ReminderKind =
  | 'streak_ending'
  | 'inactivity'
  | 'long_break'
  | 'unfinished_session'
  | 'train_today'
  | 'weekly_recap'
  | 'challenge_waiting'

export const REMINDER_TYPES: ReminderKind[] = [
  'streak_ending',
  'inactivity',
  'long_break',
  'unfinished_session',
  'train_today',
  'weekly_recap',
  'challenge_waiting',
]

export type ReminderCopy = {
  title: string
  body: string
  link: string
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
/** Daily job runs at 19:00 UTC+3. "Today" and Friday follow that clock. */
const REMINDER_TZ_OFFSET_MS = 3 * HOUR_MS

export function reminderDayKey(ms: number) {
  return new Date(ms + REMINDER_TZ_OFFSET_MS).toISOString().slice(0, 10)
}

function isReminderFriday(now: number) {
  return new Date(now + REMINDER_TZ_OFFSET_MS).getUTCDay() === 5
}

export type ReminderInput = {
  now: number
  language: 'en' | 'ar'
  prefs: Partial<NotificationPreferences> | null
  streakDays: number
  hoursLeft: number | null
  lastFinishedAt: string | null
  openSessionStartedAt: string | null
  trainedToday: boolean
  sessionsThisWeek: number
  challengeCount: number
  recent: { type: string; createdAt: string }[]
}

function prefOn(
  prefs: Partial<NotificationPreferences> | null,
  key: keyof NotificationPreferences,
  fallback: boolean,
) {
  const value = prefs?.[key]
  return typeof value === 'boolean' ? value : fallback
}

function sentSince(
  recent: ReminderInput['recent'],
  type: ReminderKind,
  windowMs: number,
  now: number,
) {
  return recent.some((row) => {
    if (row.type !== type) return false
    const at = new Date(row.createdAt).getTime()
    return Number.isFinite(at) && now - at < windowMs
  })
}

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  const at = new Date(iso).getTime()
  if (!Number.isFinite(at)) return null
  return (now - at) / DAY_MS
}

/** Up to two phone reminders, most urgent first. */
export function chooseTrainingReminders(input: ReminderInput): ReminderKind[] {
  const kinds: ReminderKind[] = []
  const streakOn = prefOn(input.prefs, 'streak_reminder', true)
  const inactiveOn = prefOn(input.prefs, 'inactivity_reminder', true)
  const unfinishedOn = prefOn(input.prefs, 'unfinished_session', false)
  const trainTodayOn = prefOn(input.prefs, 'train_today', true)
  const weeklyOn = prefOn(input.prefs, 'weekly_recap', true)
  const challengeOn = prefOn(input.prefs, 'challenge_reminder', true)

  const openForMs = input.openSessionStartedAt
    ? input.now - new Date(input.openSessionStartedAt).getTime()
    : 0
  if (
    unfinishedOn &&
    input.openSessionStartedAt &&
    openForMs >= 3 * HOUR_MS &&
    !sentSince(input.recent, 'unfinished_session', 12 * HOUR_MS, input.now)
  ) {
    kinds.push('unfinished_session')
  }

  const streakDue =
    streakOn &&
    input.streakDays > 0 &&
    input.hoursLeft != null &&
    input.hoursLeft > 0 &&
    input.hoursLeft <= 18 &&
    !sentSince(input.recent, 'streak_ending', 20 * HOUR_MS, input.now)
  if (streakDue) kinds.push('streak_ending')

  if (
    challengeOn &&
    input.challengeCount > 0 &&
    !sentSince(input.recent, 'challenge_waiting', 2 * DAY_MS, input.now)
  ) {
    kinds.push('challenge_waiting')
  }

  const quietDays = daysSince(input.lastFinishedAt, input.now)
  const trainingOpen = input.openSessionStartedAt != null
  if (inactiveOn && !streakDue && !trainingOpen && quietDays != null && quietDays >= 7) {
    if (!sentSince(input.recent, 'long_break', 7 * DAY_MS, input.now)) {
      kinds.push('long_break')
    }
  } else if (
    inactiveOn &&
    !streakDue &&
    !trainingOpen &&
    quietDays != null &&
    quietDays >= 3 &&
    !sentSince(input.recent, 'inactivity', 3 * DAY_MS, input.now)
  ) {
    kinds.push('inactivity')
  }

  const recentlyActive = quietDays != null && quietDays < 2
  if (
    trainTodayOn &&
    !streakDue &&
    !trainingOpen &&
    !input.trainedToday &&
    recentlyActive &&
    !sentSince(input.recent, 'train_today', 20 * HOUR_MS, input.now)
  ) {
    kinds.push('train_today')
  }

  const friday = isReminderFriday(input.now)
  if (
    weeklyOn &&
    friday &&
    input.sessionsThisWeek > 0 &&
    !sentSince(input.recent, 'weekly_recap', 6 * DAY_MS, input.now)
  ) {
    kinds.push('weekly_recap')
  }

  return kinds.slice(0, 2)
}

function countLabel(count: number, language: 'en' | 'ar', unit: 'days' | 'hours') {
  const n = Math.max(1, Math.round(count))
  if (language === 'ar') {
    if (unit === 'hours') {
      if (n === 1) return 'ساعة'
      if (n === 2) return 'ساعتين'
      return `${n} ساعات`
    }
    if (n === 1) return 'يوم'
    if (n === 2) return 'يومين'
    return `${n} أيام`
  }
  if (unit === 'hours') return n === 1 ? '1 hour' : `${n} hours`
  return n === 1 ? '1 day' : `${n} days`
}

export function reminderCopy(
  kind: ReminderKind,
  language: 'en' | 'ar',
  facts: {
    streakDays: number
    hoursLeft: number | null
    quietDays: number | null
    sessionsThisWeek: number
    challengeCount: number
  },
): ReminderCopy {
  const link = '/dashboard/workout'
  if (kind === 'streak_ending') {
    const hours = countLabel(facts.hoursLeft ?? 1, language, 'hours')
    const days = countLabel(facts.streakDays, language, 'days')
    if (language === 'ar') {
      return {
        title: 'سلسلتك قاربت على الانتهاء',
        body: `سلسلة ${days} تنتهي خلال ${hours}. تدرّب اليوم لتحافظ عليها.`,
        link,
      }
    }
    return {
      title: 'Your streak is about to end',
      body: `Your ${days} streak ends in ${hours}. Train today to keep it.`,
      link,
    }
  }

  if (kind === 'long_break') {
    const days = countLabel(facts.quietDays ?? 7, language, 'days')
    if (language === 'ar') {
      return {
        title: 'انقطاع طويل',
        body: `مرّ ${days} على آخر تمرين. ابدأ بجلسة خفيفة اليوم.`,
        link,
      }
    }
    return {
      title: 'It has been a long break',
      body: `${days} since your last workout. Start with an easy session today.`,
      link,
    }
  }

  if (kind === 'inactivity') {
    const days = countLabel(facts.quietDays ?? 3, language, 'days')
    if (language === 'ar') {
      return {
        title: 'لم تتدرب منذ فترة',
        body: `مرّ ${days} على آخر جلسة. تمرين قصير يبقي العادة.`,
        link,
      }
    }
    return {
      title: "You haven't trained in a while",
      body: `It's been ${days} since your last session. A short workout keeps the habit.`,
      link,
    }
  }

  if (kind === 'train_today') {
    if (language === 'ar') {
      return {
        title: 'لم تتدرب اليوم',
        body: 'اليوم لم يُغلق بعد. جلسة واحدة تُبقي السلسلة والعادة.',
        link,
      }
    }
    return {
      title: 'No workout yet today',
      body: 'The day is still open. One session keeps the habit going.',
      link,
    }
  }

  if (kind === 'weekly_recap') {
    const sessions = Math.max(1, Math.round(facts.sessionsThisWeek))
    if (language === 'ar') {
      return {
        title: 'ملخص هذا الأسبوع',
        body:
          sessions === 1
            ? 'أنهيت جلسة واحدة هذا الأسبوع. افتح التقدم لترى التفاصيل.'
            : `أنهيت ${sessions} جلسات هذا الأسبوع. افتح التقدم لترى التفاصيل.`,
        link: '/dashboard/progress',
      }
    }
    return {
      title: 'Your week of training',
      body:
        sessions === 1
          ? 'You finished 1 session this week. Open Progress to see the details.'
          : `You finished ${sessions} sessions this week. Open Progress to see the details.`,
      link: '/dashboard/progress',
    }
  }

  if (kind === 'challenge_waiting') {
    const count = Math.max(1, facts.challengeCount)
    if (language === 'ar') {
      return {
        title: 'تحدٍ ينتظرك',
        body:
          count === 1
            ? 'لديك تحدٍ مع صديق لم يُحسم بعد.'
            : `لديك ${count} تحديات مع أصدقاء لم تُحسم بعد.`,
        link: '/dashboard/challenges',
      }
    }
    return {
      title: 'A challenge is waiting',
      body:
        count === 1
          ? 'You have a friend challenge that is still open.'
          : `You have ${count} friend challenges still open.`,
      link: '/dashboard/challenges',
    }
  }

  if (language === 'ar') {
    return {
      title: 'جلستك ما زالت مفتوحة',
      body: 'بدأت تمريناً ولم تنهه. ارجع وأغلق الجلسة أو كمّلها.',
      link,
    }
  }
  return {
    title: 'Your workout is still open',
    body: 'You started a session and have not finished it.',
    link,
  }
}
