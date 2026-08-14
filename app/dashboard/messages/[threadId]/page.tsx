import { notFound, redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { DmThreadChat } from '@/components/dm-thread-chat'
import { getThreadForUser } from '@/lib/data/social'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ threadId: string }>
}

export const metadata = {
  title: 'Chat — IRONSTACK',
}

export default async function DmThreadPage({ params }: PageProps) {
  const { threadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [thread, profileResult] = await Promise.all([
    getThreadForUser(threadId, user.id),
    getProfile(user.id),
  ])

  if (!thread) notFound()

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
      <DmThreadChat
        threadId={thread.thread.id}
        currentUserId={user.id}
        threadStatus={thread.thread.status}
        isFriend={thread.isFriend}
        other={thread.other}
        initialMessages={thread.messages}
      />
    </div>
  )
}
