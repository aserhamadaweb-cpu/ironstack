import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageError } from '@/components/page-states'
import { OfflineHomeRedirect } from '@/components/offline-home-redirect'
import { OfflineProfilePage } from '@/components/offline-profile-page'
import { UnifiedProfileView } from '@/components/public-profile-view'
import { getPublicProfileBundle } from '@/lib/data/social'
import { initialsFrom } from '@/lib/dashboard-utils'
import { isNetworkFailure } from '@/lib/log'
import { createClient, getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Profile — IRONSTACK',
  description: 'Your IRONSTACK profile and personal records.',
}

/**
 * Self profile under the dashboard layout tree.
 * Do NOT redirect to /profile/[id] — that layout swap trips Next App Router's
 * mpaNavigation path (hooks after an early thenable throw → React #310).
 */
export default async function ProfilePage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login?next=/dashboard/profile')

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
  } = { data: null }

  try {
    const [nextBundle, nextViewer] = await Promise.all([
      getPublicProfileBundle(userId, userId),
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
      return (
        <OfflineHomeRedirect>
          <OfflineProfilePage />
        </OfflineHomeRedirect>
      )
    }
    throw err
  }

  if (!bundle.data) {
    if (bundle.error && isNetworkFailure(bundle.error)) {
      return (
        <OfflineHomeRedirect>
          <OfflineProfilePage />
        </OfflineHomeRedirect>
      )
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

  const editInitial = {
    userId,
    username: bundle.data.profile.username ?? '',
    displayName: bundle.data.profile.display_name || viewerName,
    bio: bundle.data.profile.bio ?? viewerLite.data?.bio ?? '',
    avatarUrl: bundle.data.profile.avatar_url,
    usernameChangeCount: viewerLite.data?.username_change_count ?? 0,
  }

  return (
    <div className="min-h-svh">
      <DashboardNav
        userName={viewerName}
        initials={initialsFrom(viewerName)}
        profileHref="/dashboard/profile"
        avatarUrl={viewerLite.data?.avatar_url}
        isGuest={viewerLite.data?.is_guest === true}
      />
      <UnifiedProfileView
        data={bundle.data}
        editInitial={editInitial}
        viewerIsGuest={viewerLite.data?.is_guest === true}
        weightUnit={viewerLite.data?.preferred_unit === 'lb' ? 'lb' : 'kg'}
      />
    </div>
  )
}
