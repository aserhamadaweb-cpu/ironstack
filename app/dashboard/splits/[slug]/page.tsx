import { notFound, redirect } from 'next/navigation'
import { SplitDetailPage } from '@/components/split-detail-page'
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

  if (!split) {
    return { title: 'Split — IRONSTACK' }
  }

  return {
    title: `${split.name} — IRONSTACK`,
    description: split.description,
  }
}

export default async function SplitPage({ params }: Params) {
  const { slug } = await params
  const baseSplit = getSplitBySlug(slug)

  if (!baseSplit) {
    notFound()
  }

  // Pull real photo thumbnails from the same dataset the builder uses.
  const split = withResolvedImages(baseSplit)

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

  return (
    <SplitDetailPage
      split={split}
      displayName={displayName}
      initials={initialsFrom(displayName)}
    />
  )
}
