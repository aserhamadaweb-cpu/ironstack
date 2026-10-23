import { notFound, redirect } from 'next/navigation'
import { ActiveSessionGate } from '@/components/active-session-gate'
import {
  countCompletedSessions,
  getPreviousBestsMap,
  getProfile,
  getSplitDetail,
} from '@/lib/data/queries'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { enrichSplitFromLibrary } from '@/lib/exercise-library.server'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getAuthIdentity } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params) {
  const { slug } = await params
  try {
    const result = await getSplitDetail(slug)
    return {
      title: result.data
        ? `Active Session · ${result.data.name} — IRONSTACK`
        : 'Active Session — IRONSTACK',
      description: 'Log your sets, chase PRs, and finish strong.',
    }
  } catch {
    return {
      title: 'Active Session — IRONSTACK',
      description: 'Log your sets, chase PRs, and finish strong.',
    }
  }
}

export default async function ActiveSessionPage({ params }: Params) {
  const { slug } = await params

  const { userId, email } = await getAuthIdentity()
  if (!userId) {
    redirect('/login')
  }

  let split = null
  let displayName = email?.split('@')[0] || 'Athlete'
  let initials = 'A'
  let avatarUrl: string | null = null
  let isFirstEver = false
  let weightUnit: 'kg' | 'lb' = 'kg'
  let previousBests: Record<
    string,
    { weight: number; reps: number; durationSeconds?: number | null }
  > = {}

  try {
    const [splitResult, profileResult, countResult] = await Promise.all([
      getSplitDetail(slug),
      getProfile(userId),
      countCompletedSessions(userId),
    ])

    if (splitResult.error && !splitResult.data) {
      return (
        <ActiveSessionGate
          slug={slug}
          displayName={
            profileResult.data?.display_name ||
            email?.split('@')[0] ||
            'Athlete'
          }
          initials={initialsFrom(
            profileResult.data?.display_name ||
              email?.split('@')[0] ||
              'Athlete',
          )}
          avatarUrl={profileResult.data?.avatar_url}
          isFirstEver={(countResult.data ?? 0) === 0}
          weightUnit={profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'}
        />
      )
    }

    if (!splitResult.data) {
      return (
        <ActiveSessionGate
          slug={slug}
          displayName={
            profileResult.data?.display_name ||
            email?.split('@')[0] ||
            'Athlete'
          }
          initials={initialsFrom(
            profileResult.data?.display_name ||
              email?.split('@')[0] ||
              'Athlete',
          )}
          avatarUrl={profileResult.data?.avatar_url}
          isFirstEver={(countResult.data ?? 0) === 0}
          weightUnit={profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'}
        />
      )
    }

    split = enrichSplitFromLibrary(toSplitDetail(splitResult.data))
    const liftTypeIds = split.schedule.flatMap((day) =>
      day.exercises.map((ex) => ex.liftTypeId).filter(Boolean),
    ) as string[]

    const bestsResult = await getPreviousBestsMap(userId, liftTypeIds)
    previousBests = bestsResult.data ?? {}

    displayName =
      profileResult.data?.display_name ||
      email?.split('@')[0] ||
      'Athlete'
    initials = initialsFrom(displayName)
    avatarUrl = profileResult.data?.avatar_url ?? null
    isFirstEver = (countResult.data ?? 0) === 0
    weightUnit = profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'
  } catch {
    return (
      <ActiveSessionGate
        slug={slug}
        displayName={displayName}
        initials={initialsFrom(displayName)}
        isFirstEver={false}
        weightUnit="kg"
      />
    )
  }

  if (!split) notFound()

  return (
    <ActiveSessionGate
      slug={slug}
      displayName={displayName}
      initials={initials}
      avatarUrl={avatarUrl}
      isFirstEver={isFirstEver}
      weightUnit={weightUnit}
      initialSplit={split}
      initialBests={previousBests}
    />
  )
}
