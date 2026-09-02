import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { MessagesInbox } from '@/components/messages-inbox'
import { listGroupChatsForUser } from '@/lib/data/group-chats'
import { listDmThreads } from '@/lib/data/social'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Messages — IRONSTACK',
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, threads, groups] = await Promise.all([
    getProfile(user.id),
    listDmThreads(user.id),
    listGroupChatsForUser(user.id),
  ])

  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <div className="min-h-svh">
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        profileHref={profileHref(profileResult.data?.username, user.id)}
        avatarUrl={profileResult.data?.avatar_url}
        isGuest={profileResult.data?.is_guest === true}
      />
      <OfflineConnectionGate feature="messages">
      <GuestPageGate reason="messages" returnPath="/dashboard/messages">
      <MessagesInbox
        currentUserId={user.id}
        threads={threads}
        groups={groups}
      />
      </GuestPageGate>
      </OfflineConnectionGate>
    </div>
  )
}
