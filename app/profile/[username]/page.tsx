import { notFound, redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageError } from '@/components/page-states'
import { UnifiedProfileView } from '@/components/public-profile-view'
import { OfflineProfilePage } from '@/components/offline-profile-page'
import { getPublicProfileBundle } from '@/lib/data/social'
import { initialsFrom } from '@/lib/dashboard-utils'
import { isNetworkFailure } from '@/lib/log'
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

  let bundle: Awaited<ReturnType<typeof getPublicProfileBundle>>
  let viewerLite: {
    data: {
      display_name: string | null
      username: string | null
      is_guest: boolean | null
      avatar_url: string | null
      preferred_unit: 'kg' | 'lb' | null
      username_change_count: number | null
      bio: string | null
    } | null
  } = {
    data: null,
  }
  try {
    const [nextBundle, nextViewer] = await Promise.all([
      getPublicProfileBundle(decodeURIComponent(username), userId),
      supabase
        .from('profiles')
        .select(
          'display_name, username, is_guest, avatar_url, preferred_unit, username_change_count, bio',
        )
        .eq('id', userId)
        .maybeSingle(),
    ])
    bundle = nextBundle
    viewerLite = nextViewer
  } catch (err) {
    if (isNetworkFailure(err)) {
      return <OfflineProfilePage />
    }
    throw err
  }

  if (!bundle.data) {
    if (bundle.error === 'Profile not found.') {
      notFound()
    }
    if (bundle.error && isNetworkFailure(bundle.error)) {
      return <OfflineProfilePage />
    }
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={bundle.error || 'Could not load this profile.'} />
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
        bio: bundle.data.profile.bio ?? viewerLite.data?.bio ?? '',
        avatarUrl: bundle.data.profile.avatar_url,
        usernameChangeCount: viewerLite.data?.username_change_count ?? 0,
      }
    : undefined

  return (
    <div className="min-h-svh">
      <DashboardNav
        userName={viewerName}
        initials={initialsFrom(viewerName)}
        profileHref={profileHref(viewerLite.data?.username, userId)}
        avatarUrl={viewerLite.data?.avatar_url}
        isGuest={viewerLite.data?.is_guest === true}
      />
      <UnifiedProfileView
        data={bundle.data}
        editInitial={editInitial}
        viewerIsGuest={viewerLite.data?.is_guest === true}
        weightUnit={
          viewerLite.data?.preferred_unit === 'lb' ? 'lb' : 'kg'
        }
      />
    </div>
  )
}
