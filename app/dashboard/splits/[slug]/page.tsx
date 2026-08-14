import { notFound, redirect } from 'next/navigation'
import { PageError } from '@/components/page-states'
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

  if (splitResult.error || profileResult.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={splitResult.error || profileResult.error || 'Error'} />
      </main>
    )
  }

  if (!splitResult.data) {
    notFound()
  }

  const split = enrichSplitFromLibrary(toSplitDetail(splitResult.data))
  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <SplitDetailPage
      split={split}
      displayName={displayName}
      initials={initialsFrom(displayName)}
      viewerUserId={user.id}
    />
  )
}
