import { redirect } from 'next/navigation'
import { FitnessProfilePage } from '@/components/fitness-profile-page'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineHomeRedirect } from '@/components/offline-home-redirect'
import { loadOnboardingPageState } from '@/lib/data/onboarding-read'
import { getAuthIdentity, createClient } from '@/lib/supabase/server'
import { userNeedsOnboarding } from '@/lib/onboarding-storage'

export const metadata = {
  title: 'Fitness Profile — IRONSTACK',
  description: 'View and edit your goals, body stats, and training preferences.',
}

export default async function FitnessProfileRoute() {
  const { userId } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (userNeedsOnboarding(user)) {
    redirect('/onboarding')
  }

  const state = await loadOnboardingPageState()
  const displayName =
    state.data.displayName.trim() ||
    state.email?.split('@')[0] ||
    'Athlete'

  return (
    <OfflineHomeRedirect>
      <GuestPageGate
        reason="editProfile"
        returnPath="/dashboard/fitness-profile"
      >

        <FitnessProfilePage initialData={state.data} />
      </GuestPageGate>
    </OfflineHomeRedirect>
  )
}
