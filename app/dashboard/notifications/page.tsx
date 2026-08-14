import { redirect } from 'next/navigation'
import { NotificationSettings } from '@/components/notification-settings'
import { DashboardNav } from '@/components/dashboard-nav'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Notifications — IRONSTACK',
  description: 'Manage IronStack notification preferences.',
}

export default async function NotificationsPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const profileResult = await getProfile(userId)
  const profile = profileResult.data
  const displayName =
    profile?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        profileHref={profileHref(profile?.username, userId)}
      />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <NotificationSettings />
      </main>
    </>
  )
}
