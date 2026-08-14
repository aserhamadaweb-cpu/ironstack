import { notFound, redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageError } from '@/components/page-states'
import { UnifiedProfileView } from '@/components/public-profile-view'
import { getPublicProfileBundle } from '@/lib/data/social'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { createClient, getAuthIdentity } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params
  return {
    title: `@${username} — IRONSTACK`,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect(`/login?next=/profile/${username}`)

  const supabase = await createClient()

  // Bundle is the heavy path; viewer name is a cheap parallel select (skip full getProfile).
  const [bundle, viewerLite] = await Promise.all([
    getPublicProfileBundle(decodeURIComponent(username), userId),
    supabase
      .from('profiles')
      .select('display_name, username, is_guest')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (bundle.error === 'Profile not found.' || !bundle.data) {
    notFound()
  }
  if (bundle.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={bundle.error} />
      </main>
    )
  }

  const viewerName =
    viewerLite.data?.display_name ||
    viewerLite.data?.username ||
    email?.split('@')[0] ||
    'Athlete'

  const editInitial = bundle.data.isSelf
    ? {
        userId,
        username: bundle.data.profile.username ?? '',
        displayName:
          bundle.data.profile.display_name ||
          viewerName,
        bio: bundle.data.profile.bio ?? '',
        avatarUrl: bundle.data.profile.avatar_url,
      }
    : undefined

  return (
    <div className="min-h-svh pb-20 md:pb-0">
      <DashboardNav
        userName={viewerName}
        initials={initialsFrom(viewerName)}
        profileHref={profileHref(viewerLite.data?.username, userId)}
        avatarUrl={bundle.data.isSelf ? bundle.data.profile.avatar_url : undefined}
        isGuest={viewerLite.data?.is_guest === true}
      />
      <UnifiedProfileView
        data={bundle.data}
        editInitial={editInitial}
        viewerIsGuest={viewerLite.data?.is_guest === true}
      />
    </div>
  )
}
