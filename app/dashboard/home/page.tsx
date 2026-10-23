import { Suspense } from 'react'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { HomeCommunity } from '@/components/home-community'
import { HomeDashboard } from '@/components/home-dashboard'
import {
  getCompletedSessions,
  getProfile,
  getSplitsForUser,
} from '@/lib/data/queries'
import { getPrimarySplitSummary } from '@/lib/data/split-recommendations-server'
import { refreshSuggestions } from '@/lib/ai/suggestions'
import { ltrEmbed } from '@/lib/bidi'
import { fetchStreakStatus } from '@/lib/data/streak'
import { isSameLocalDay } from '@/lib/session-store'
import { getAuthIdentity } from '@/lib/supabase/server'
import { emptyOnboardingData } from '@/lib/onboarding-types'
import {
  completenessFromOnboarding,
  getMissingProfileFields,
  labelMissingField,
} from '@/lib/profile-completeness'

export const metadata = {
  title: 'Home — IRONSTACK',
  description:
    'Your IronStack home: community, motivation, and what makes us different.',
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default async function HomePage() {
  const tDays = await getTranslations('days')
  const tHome = await getTranslations('home')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  let profileResult: Awaited<ReturnType<typeof getProfile>> = {
    data: null,
    error: null,
  }
  let sessionsResult: Awaited<ReturnType<typeof getCompletedSessions>> = {
    data: [],
    error: null,
  }
  let streakStatus = { streakDays: 0, hoursLeft: null as number | null }
  let splitsResult: Awaited<ReturnType<typeof getSplitsForUser>> = {
    data: [],
    error: null,
  }
  let primarySplit = { id: null as string | null, name: null as string | null }

  try {
    const fetched = await Promise.all([
      getProfile(userId),
      getCompletedSessions(userId, 21),
      fetchStreakStatus(userId),
      getSplitsForUser(userId),
      getPrimarySplitSummary(userId),
    ])
    profileResult = fetched[0]
    sessionsResult = fetched[1]
    streakStatus = fetched[2]
    splitsResult = fetched[3]
    primarySplit = fetched[4]
  } catch {
    /* Offline / unreachable Supabase — render Home with cached client data. */
  }

  // Home is the post-login landing page, so this is where proactive coach
  // suggestions get generated. Deferred so it never blocks the render, and
  // internally rate-limited, so most loads are a no-op.
  after(async () => {
    try {
      await refreshSuggestions(userId)
    } catch {
      /* A missing nudge is not worth surfacing. */
    }
  })

  const liveDegraded = Boolean(profileResult.error || sessionsResult.error || !profileResult.data)

  const profile = profileResult.data
  const sessions = sessionsResult.data ?? []
  const tCommon = await getTranslations('common')

  const displayName =
    profile?.display_name || email?.split('@')[0] || tCommon('athlete')
  const username = profile?.username || undefined

  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const weekActivity = DAY_KEYS.map((key, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const done = sessions.some((session) =>
      isSameLocalDay(new Date(session.started_at), date),
    )
    return { day: tDays(key), done }
  })

  const weekSessionCount = weekActivity.filter((d) => d.done).length

  const streak = streakStatus.streakDays
  const streakHoursLeft = streakStatus.hoursLeft

  const latest = sessions[0] ?? null
  let lastSessionCaption = tHome('noSessionsYet')
  if (latest) {
    const date = ltrEmbed(
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(latest.started_at)),
    )
    const name = ltrEmbed(
      latest.split_days?.name
        ? `${latest.split_days.name} · ${latest.splits?.name ?? tHome('splitFallback')}`
        : (latest.splits?.name ?? tHome('workoutFallback')),
    )
    lastSessionCaption = tHome('lastSession', { name, date })
  }

  const unit = profileResult.data?.preferred_unit ?? 'kg'

  const customSplits = (splitsResult.data ?? []).filter(
    (s) => s.user_id === userId && !s.is_system,
  )
  const customSplitCount = customSplits.length
  const featuredSplitId =
    (primarySplit.id &&
    customSplits.some((s) => s.id === primarySplit.id)
      ? primarySplit.id
      : null) ??
    customSplits[0]?.id ??
    null
  const featuredSplitName =
    (featuredSplitId &&
      (customSplits.find((s) => s.id === featuredSplitId)?.name ??
        primarySplit.name)) ||
    null
  const completedSessionCount = sessions.length

  const missing = getMissingProfileFields(
    completenessFromOnboarding(emptyOnboardingData(), {
      weightKg:
        profile?.current_weight_kg != null
          ? Number(profile.current_weight_kg)
          : null,
      heightCm: profile?.height_cm ?? null,
      gender: profile?.gender ?? null,
      birthDate: profile?.birth_date ?? null,
    }),
  )
  const profileMissingCount = missing.length
  const profileMissingLabels = missing.map(labelMissingField)

  const isGuest = profile?.is_guest === true

  return (
    <HomeDashboard
      displayName={displayName}
      email={email ?? ''}
      username={username}
      isGuest={isGuest}
      weekActivity={weekActivity}
      weekSessionCount={weekSessionCount}
      streakDays={streak}
      streakHoursLeft={streakHoursLeft}
      lastSessionCaption={lastSessionCaption}
      currentUserId={userId}
      weightUnit={unit}
      community={
        <Suspense
          fallback={
            <div
              className="mb-8 h-40 animate-pulse rounded-2xl bg-silver/10 sm:mb-10"
              aria-hidden="true"
            />
          }
        >
          <HomeCommunity userId={userId} unit={unit} isGuest={isGuest} />
        </Suspense>
      }
      avatarUrl={profile?.avatar_url}
      liveDegraded={liveDegraded}
      customSplitCount={customSplitCount}
      completedSessionCount={completedSessionCount}
      featuredSplitId={featuredSplitId}
      featuredSplitName={featuredSplitName}
      profileMissingCount={profileMissingCount}
      profileMissingLabels={profileMissingLabels}
    />
  )
}
