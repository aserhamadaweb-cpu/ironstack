import { redirect } from 'next/navigation'
import { SplitDetailGate } from '@/components/split-local-gate'
import { SplitDetailPage } from '@/components/split-detail-page'
import { getProfile, getSplitDetail } from '@/lib/data/queries'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { enrichSplitFromLibrary } from '@/lib/exercise-library.server'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params) {
  const { slug } = await params
  const result = await getSplitDetail(slug)
  const split = result.data

  return {
    title: split ? `${split.name} — IRONSTACK` : 'Split — IRONSTACK',
    description: split?.description ?? 'Training split details',
  }
}

export default async function SplitPage({ params }: Params) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [splitResult, profileResult] = await Promise.all([
    getSplitDetail(slug),
    getProfile(user.id),
  ])

  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  if (!splitResult.data) {
    return (
      <SplitDetailGate
        slug={slug}
        displayName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        viewerUserId={user.id}
      />
    )
  }

  const split = enrichSplitFromLibrary(toSplitDetail(splitResult.data))

  return (
    <SplitDetailPage
      split={split}
      displayName={displayName}
      initials={initialsFrom(displayName)}
      avatarUrl={profileResult.data?.avatar_url}
      viewerUserId={user.id}
    />
  )
}
