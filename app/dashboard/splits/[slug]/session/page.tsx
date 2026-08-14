import { notFound, redirect } from 'next/navigation'
import { ActiveSession } from '@/components/active-session'
import { PageError } from '@/components/page-states'
import {
  countCompletedSessions,
  getPreviousBestsMap,
  getProfile,
  getSplitDetail,
} from '@/lib/data/queries'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { enrichSplitFromLibrary } from '@/lib/exercise-library.server'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params) {
  const { slug } = await params
  const result = await getSplitDetail(slug)
  return {
    title: result.data
      ? `Active Session · ${result.data.name} — IRONSTACK`
      : 'Active Session — IRONSTACK',
    description: 'Log your sets, chase PRs, and finish strong.',
  }
}

export default async function ActiveSessionPage({ params }: Params) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [splitResult, profileResult, countResult] = await Promise.all([
    getSplitDetail(slug),
    getProfile(user.id),
    countCompletedSessions(user.id),
  ])

  if (splitResult.error || profileResult.error || countResult.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError
          message={
            splitResult.error ||
            profileResult.error ||
            countResult.error ||
            'Error'
          }
        />
      </main>
    )
  }

  if (!splitResult.data) {
    notFound()
  }

  const split = enrichSplitFromLibrary(toSplitDetail(splitResult.data))
  const liftTypeIds = split.schedule.flatMap((day) =>
    day.exercises.map((ex) => ex.liftTypeId).filter(Boolean),
  ) as string[]

  const bestsResult = await getPreviousBestsMap(user.id, liftTypeIds)
  if (bestsResult.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={bestsResult.error} />
      </main>
    )
  }

  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <ActiveSession
      split={split}
      displayName={displayName}
      initials={initialsFrom(displayName)}
      isFirstEver={(countResult.data ?? 0) === 0}
      previousBests={bestsResult.data ?? {}}
      weightUnit={profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'}
    />
  )
}
