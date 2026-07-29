import { redirect } from 'next/navigation'
import { AiCoachDashboard } from '@/components/ai-coach-dashboard'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'AI Coach — IRONSTACK',
  description: 'Your personal AI training companion.',
}

export default async function AiCoachPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const metadataName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : ''
  const displayName = metadataName || user.email?.split('@')[0] || 'Athlete'

  return <AiCoachDashboard displayName={displayName} />
}
