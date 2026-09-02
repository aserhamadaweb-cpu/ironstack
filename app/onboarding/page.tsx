import { redirect } from 'next/navigation'
import { OnboardingFlow } from '@/components/onboarding-flow'
import { loadOnboardingPageState } from '@/lib/data/onboarding-read'
import { userNeedsOnboarding } from '@/lib/onboarding-storage'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Welcome — IRONSTACK',
  description: 'Set up your IronStack fitness profile.',
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; next?: string }>
}) {
  const params = await searchParams
  const editMode = params.edit === '1'
  const returnNext =
    params.next &&
    params.next.startsWith('/') &&
    !params.next.startsWith('//')
      ? params.next
      : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/onboarding')
  }

  if (user.is_anonymous) {
    // Cookie clear happens in the route handler (Server Components cannot set cookies).
    redirect('/onboarding/continue')
  }

  const needs = userNeedsOnboarding(user)

  // Completed users (or stale gate cookie): clear via Route Handler, then home.
  if (!editMode && !needs) {
    redirect('/onboarding/continue')
  }

  // Use a plain server helper — do not call a 'use server' action during RSC render
  // (that path previously surfaced cookie-mutation errors in production logs).
  const state = await loadOnboardingPageState()

  return (
    <OnboardingFlow
      initialData={state.data}
      incomplete={needs || state.incomplete}
      editMode={editMode}
      userId={user.id}
      initialAvatarUrl={state.avatarUrl}
      returnNext={returnNext}
    />
  )
}
