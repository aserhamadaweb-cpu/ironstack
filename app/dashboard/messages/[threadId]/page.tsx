import { notFound, redirect } from 'next/navigation'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { DmThreadChat } from '@/components/dm-thread-chat'
import { getThreadForUser } from '@/lib/data/social'
import { getProfile } from '@/lib/data/queries'
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

      <OfflineConnectionGate feature="messages">
      <GuestPageGate reason="messages" returnPath={`/dashboard/messages/${threadId}`}>
      <DmThreadChat
        threadId={thread.thread.id}
        currentUserId={user.id}
        threadStatus={thread.thread.status}
        isFriend={thread.isFriend}
        other={thread.other}
        initialMessages={thread.messages}
      />
      </GuestPageGate>
      </OfflineConnectionGate>
    </div>
  )
}
