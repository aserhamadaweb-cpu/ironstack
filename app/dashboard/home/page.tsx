import { redirect } from 'next/navigation'
import { HomeDashboard } from '@/components/home-dashboard'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Home — IRONSTACK',
  description: 'Your IronStack home: community, motivation, and what makes us different.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const meta = user.user_metadata ?? {}
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.display_name === 'string' && meta.display_name) ||
    user.email?.split('@')[0] ||
    'Athlete'
  const username =
    typeof meta.username === 'string' ? meta.username : undefined

  return (
    <HomeDashboard
      displayName={displayName}
      email={user.email ?? ''}
      username={username}
    />
  )
}
