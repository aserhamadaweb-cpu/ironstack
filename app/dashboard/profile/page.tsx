import { redirect } from 'next/navigation'
import { ProfileDashboard } from '@/components/profile-dashboard'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Profile — IRONSTACK',
  description: 'Your IRONSTACK profile and training stats.',
}

export default async function ProfilePage() {
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
      : ''
  const displayName = metadataName || user.email?.split('@')[0] || 'Athlete'

  return <ProfileDashboard displayName={displayName} email={user.email ?? ''} />
}
