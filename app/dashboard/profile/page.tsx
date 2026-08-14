import { redirect } from 'next/navigation'
import { profileHref } from '@/lib/profile-path'
import { createClient, getAuthUserId } from '@/lib/supabase/server'

export const metadata = {
  title: 'Profile — IRONSTACK',
  description: 'Your IRONSTACK profile and personal records.',
}

/** Legacy route — unified profile lives at /profile/[username|userId]. */
export default async function ProfilePage() {
  const userId = await getAuthUserId()
  if (!userId) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  redirect(profileHref(profile?.username, userId))
}
