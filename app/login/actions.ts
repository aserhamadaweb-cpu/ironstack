'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { userNeedsOnboarding } from '@/lib/onboarding-storage'
import {
  buildTourSeedForNewAccount,
  homePathWithTourIfNeeded,
} from '@/lib/app-tour-storage'
import {
  HOME_PATH,
  ONBOARDING_COOKIE,
  ONBOARDING_PATH,
} from '@/lib/onboarding-types'
import {
  normalizeUsername,
  validateUsernameFormat,
} from '@/lib/username'
import { buildAuthCallbackUrl } from '@/lib/auth-callback-url'
import { abandonAnonymousSessionIfPresent } from '@/lib/auth/abandon-guest-session'

export type AuthState = {
  error?: string
}

export async function signUp(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const displayName = String(formData.get('displayName') ?? '').trim()
  const username = normalizeUsername(String(formData.get('username') ?? ''))

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' }
  }

  const usernameError = validateUsernameFormat(username)
  if (usernameError) {
    return { error: usernameError }
  }

  const supabase = await createClient()

  const { data: available } = await supabase.rpc('is_username_available', {
    desired: username,
  })
  if (available === false) {
    return { error: 'That username is already taken.' }
  }

  const nextRaw = String(formData.get('next') ?? ONBOARDING_PATH)
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : ONBOARDING_PATH

  await abandonAnonymousSessionIfPresent()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(next),
      data: {
        display_name: displayName || email.split('@')[0],
        username,
        onboarding_completed: false,
        onboarding_step: 1,
        ...buildTourSeedForNewAccount(),
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  const identities = data.user?.identities ?? []
  if (data.user && identities.length === 0) {
    return { error: 'An account with this email already exists. Sign in instead.' }
  }

  if (!data.session) {
    return {
      error:
        'Could not start your session after sign-up. Please try again.',
    }
  }

  // Ensure profile row has the required username (trigger may race / miss).
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: displayName || email.split('@')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.session.user.id)

  if (profileError) {
    const msg = profileError.message.toLowerCase()
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { error: 'That username is already taken.' }
    }
    return { error: profileError.message }
  }

  const jar = await cookies()
  jar.set(ONBOARDING_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  redirect(ONBOARDING_PATH)
}

export async function signIn(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/dashboard/home')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  await abandonAnonymousSessionIfPresent()

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    return { error: signInError.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sign-in succeeded but no session was established. Try again.' }
  }

  const jar = await cookies()
  if (userNeedsOnboarding(user)) {
    jar.set(ONBOARDING_COOKIE, '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    redirect(ONBOARDING_PATH)
  }
  jar.set(ONBOARDING_COOKIE, '', { path: '/', maxAge: 0, sameSite: 'lax' })
  const fallback = homePathWithTourIfNeeded(user)
  const destination =
    next.startsWith('/') && !next.startsWith('//') ? next : fallback
  redirect(destination)
}

/** Establishes a guest session in HTTP cookies (survives PWA cold start). */
export async function signInGuest(): Promise<AuthState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInAnonymously()
  if (error) {
    return { error: error.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Could not start a guest session. Try again.' }
  }

  // Guests skip onboarding entirely — a stale gate cookie would trap them there.
  const jar = await cookies()
  jar.set(ONBOARDING_COOKIE, '', { path: '/', maxAge: 0, sameSite: 'lax' })
  redirect(HOME_PATH)
}

/** Convert the current anonymous guest into a permanent email/password account. */
export async function upgradeGuestAccount(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || password.length < 6) {
    return { error: 'Enter a valid email and a password of at least 6 characters.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.is_anonymous) {
    redirect(HOME_PATH)
  }

  const { error: updateError } = await supabase.auth.updateUser({
    email,
    password,
    data: { is_guest: false },
  })
  if (updateError) {
    return { error: updateError.message }
  }

  await supabase
    .from('profiles')
    .update({
      is_guest: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  const jar = await cookies()
  jar.set(ONBOARDING_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  redirect(ONBOARDING_PATH)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const jar = await cookies()
  jar.set(ONBOARDING_COOKIE, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  })
  redirect('/login')
}
