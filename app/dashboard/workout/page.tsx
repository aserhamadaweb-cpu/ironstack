import { redirect } from 'next/navigation'
import { WorkoutDashboard } from '@/components/workout-dashboard'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Workout — IRONSTACK',
  description: 'Your splits, last session recap, and recommended programs.',
}

export default async function WorkoutPage() {
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
  const displayName =
    metadataName || user.email?.split('@')[0] || 'Athlete'

  return <WorkoutDashboard displayName={displayName} />
}
