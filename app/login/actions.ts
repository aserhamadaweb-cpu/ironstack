'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
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
import {
  buildAuthCallbackUrl,
  GOOGLE_WEB_CLIENT_ID,
  isValidGoogleWebClientId,
} from '@/lib/auth-callback-url'
import { abandonAnonymousSessionIfPresent } from '@/lib/auth/abandon-guest-session'
import { finalizeRedirect } from '@/lib/auth/finalize-redirect'

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

  redirect(finalizeRedirect(ONBOARDING_PATH))
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

  await supabase
    .from('profiles')
    .update({ is_guest: false, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  const fallback = homePathWithTourIfNeeded(user)
  const destination =
    next.startsWith('/') && !next.startsWith('//') ? next : fallback
  redirect(finalizeRedirect(destination))
}

/** Establishes a guest session in HTTP cookies (survives PWA cold start). */
export async function signInGuest(): Promise<AuthState> {
  const supabase = await createClient()
  const {
    data: { user: existing },
  } = await supabase.auth.getUser()
  if (existing && !existing.is_anonymous) {
    redirect(HOME_PATH)
  }

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

  await supabase.auth.refreshSession()

  redirect(finalizeRedirect(ONBOARDING_PATH))
}

/**
 * Public Google Web Client ID used by Google Identity Services.
 * Prefer NEXT_PUBLIC_GOOGLE_CLIENT_ID; otherwise parse it from the OAuth URL
 * Supabase would use for redirect sign-in.
 */
export async function resolveGoogleWebClientId(): Promise<{
  clientId?: string
  error?: string
}> {
  const fromEnv = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  if (isValidGoogleWebClientId(fromEnv)) {
    return { clientId: fromEnv }
  }

  // Stable public web client — ignore Vercel Sensitive "y" placeholders.
  if (isValidGoogleWebClientId(GOOGLE_WEB_CLIENT_ID)) {
    return { clientId: GOOGLE_WEB_CLIENT_ID }
  }

  return { error: 'Google Web Client ID is not configured.' }
}

/**
 * @deprecated Prefer client `signInWithGoogleClient` — server-action cookie
 * writes are unreliable and used to surface as generic login errors.
 */
export async function signInWithGoogleIdToken(
  idToken: string,
  nextPath?: string | null,
): Promise<AuthState & { redirectTo?: string }> {
  const token = idToken.trim()
  if (!token) {
    return { error: 'Missing Google ID token.' }
  }

  await abandonAnonymousSessionIfPresent()

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
  })
  if (error) {
    return { error: error.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Google sign-in succeeded but no session was established.' }
  }

  try {
    await supabase
      .from('profiles')
      .update({ is_guest: false, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  } catch {
    /* best-effort */
  }

  const fallback = homePathWithTourIfNeeded(user)
  const destination =
    typeof nextPath === 'string' &&
    nextPath.startsWith('/') &&
    !nextPath.startsWith('//')
      ? nextPath
      : fallback

  return { redirectTo: finalizeRedirect(destination) }
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
