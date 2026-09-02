import { redirect } from 'next/navigation'
import { OfflineProfilePage } from '@/components/offline-profile-page'
import { getProfile } from '@/lib/data/queries'
import { isNetworkFailure } from '@/lib/log'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Profile — IRONSTACK',
  description: 'Your IRONSTACK profile and personal records.',
}

/** Server redirect to the live profile when online; cached profile when offline. */
export default async function ProfilePage() {
  const { userId } = await getAuthIdentity()
  if (!userId) redirect('/login?next=/dashboard/profile')

  const profileResult = await getProfile(userId)
  if (profileResult.error && isNetworkFailure(profileResult.error)) {
    return <OfflineProfilePage />
  }

  const href = profileHref(profileResult.data?.username, userId)
  if (href !== '/dashboard/profile') {
    redirect(href)
  }

  return <OfflineProfilePage />
}
