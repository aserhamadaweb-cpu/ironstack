import { notFound, redirect } from 'next/navigation'
import { ActiveSession } from '@/components/active-session'
import { SPLIT_DETAILS, getSplitBySlug } from '@/lib/split-data'
import { withResolvedImages } from '@/lib/exercise-library.server'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return SPLIT_DETAILS.map((split) => ({ slug: split.slug }))
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params
  const split = getSplitBySlug(slug)

  return {
    title: split ? `Active Session · ${split.name} — IRONSTACK` : 'Active Session — IRONSTACK',
    description: 'Log your sets, chase PRs, and finish strong.',
  }
}

export default async function ActiveSessionPage({ params }: Params) {
  const { slug } = await params
  const baseSplit = getSplitBySlug(slug)

  if (!baseSplit) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const metadataName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : ''
  const displayName = metadataName || user.email?.split('@')[0] || 'Athlete'

  // Same photo thumbnails as the builder + split detail pages.
  const split = withResolvedImages(baseSplit)

  return (
    <ActiveSession
      split={split}
      displayName={displayName}
      initials={initialsFrom(displayName)}
    />
  )
}
