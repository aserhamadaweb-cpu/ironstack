import type { ReactNode } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { DashboardShell } from '@/components/dashboard-shell'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getProfile } from '@/lib/data/queries'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId, email } = await getAuthIdentity()
  const profile = userId ? (await getProfile(userId)).data : null
  const displayName = profile?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <DashboardShell createdAt={profile?.created_at ?? null}>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profile?.avatar_url}
        profileHref={profileHref(profile?.username, userId)}
        isGuest={profile?.is_guest === true}
      />
      {children}
    </DashboardShell>
  )
}
