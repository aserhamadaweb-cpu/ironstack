import { redirect } from 'next/navigation'
import { NotificationSettings } from '@/components/notification-settings'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { DashboardNav } from '@/components/dashboard-nav'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
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
        avatarUrl={profile?.avatar_url}
        profileHref={profileHref(profile?.username, userId)}
      />
      <OfflineConnectionGate feature="notifications">
        <main className="mx-auto max-w-lg space-y-6 px-4 py-8 sm:px-6">
          <BackToTrainLink />
          <NotificationSettings />
        </main>
      </OfflineConnectionGate>
    </>
  )
}
