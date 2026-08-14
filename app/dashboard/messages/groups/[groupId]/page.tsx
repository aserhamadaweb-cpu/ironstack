import { notFound, redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { GroupChatView } from '@/components/group-chat-view'
import { getGroupChatForUser } from '@/lib/data/group-chats'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ groupId: string }>
}

export const metadata = {
  title: 'Group Chat — IRONSTACK',
}

export default async function GroupChatPage({ params }: PageProps) {
  const { groupId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [detail, profileResult] = await Promise.all([
    getGroupChatForUser(groupId, user.id),
    getProfile(user.id),
  ])

  if (!detail) notFound()

  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <div className="min-h-svh">
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
      />
      <GroupChatView currentUserId={user.id} detail={detail} />
    </div>
  )
}
