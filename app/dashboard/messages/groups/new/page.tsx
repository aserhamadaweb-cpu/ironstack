import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CreateGroupChatForm } from '@/components/create-group-chat-form'
import { DashboardNav } from '@/components/dashboard-nav'
import { getAcceptedFriends, getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'New Group — IRONSTACK',
}

export default async function NewGroupChatPage() {
  const tCommon = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, friendsResult] = await Promise.all([
    getProfile(user.id),
    getAcceptedFriends(user.id),
  ])

  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    tCommon('athlete')

  const friends = (friendsResult.data ?? []).map(({ profile }) => ({
    id: profile.id,
    name: profile.display_name || profile.username || tCommon('friend'),
    username: profile.username,
    avatarUrl: profile.avatar_url,
  }))

  return (
    <div className="min-h-svh pb-20 md:pb-0">
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
      />
      <CreateGroupChatForm friends={friends} />
    </div>
  )
}
