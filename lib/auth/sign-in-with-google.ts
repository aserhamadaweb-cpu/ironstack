'use client'

import {
  GOOGLE_WEB_CLIENT_ID,
  buildOAuthReturnUrl,
  isValidGoogleWebClientId,
} from '@/lib/auth-callback-url'
import { finalizeRedirect } from '@/lib/auth/finalize-redirect'
import {
  isGoogleIdentityError,
  requestGoogleIdToken,
} from '@/lib/google-identity'
import { createClient } from '@/lib/supabase/client'
import { handleAuthUserChanged } from '@/lib/clear-client-user-state'
import { clearIronstackAuthCache } from '@/components/use-is-guest'

export type GoogleSignInResult =
  | { ok: true; redirectTo: string }
  | { ok: true; redirected: true }
  | { ok: false; error: string; cancelled?: boolean }

function resolveGoogleClientId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  if (isValidGoogleWebClientId(fromEnv)) return fromEnv
  if (isValidGoogleWebClientId(GOOGLE_WEB_CLIENT_ID)) return GOOGLE_WEB_CLIENT_ID
  return null
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    nav.standalone === true
  )
}

async function abandonGuestInBrowser(
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.is_anonymous) {
      await supabase.auth.signOut({ scope: 'global' })
    }
  } catch {
    /* guest cleanup is best-effort */
  }
}

async function syncSessionCookies(input: {
  accessToken: string
  refreshToken: string
  next: string
}): Promise<string> {
  try {
    const res = await fetch('/api/auth/oauth-session', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        next: input.next,
      }),
    })
    const payload = (await res.json().catch(() => null)) as {
      redirect?: string
    } | null
    if (res.ok && payload?.redirect) return payload.redirect
  } catch {
    /* cookie sync is best-effort */
  }
  return finalizeRedirect(input.next)
}

async function redirectOAuthGoogle(nextPath: string): Promise<GoogleSignInResult> {
  const supabase = createClient()
  const redirectTo = buildOAuthReturnUrl(nextPath, window.location.origin)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: false,
    },
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  // Browser is navigating away to Google.
  return { ok: true, redirected: true }
}

function shouldFallbackToOAuth(err: unknown): boolean {
  if (!isGoogleIdentityError(err)) {
    const message = err instanceof Error ? err.message : String(err ?? '')
    return /failed to load|unregistered_origin|invalid_client|origin/i.test(
      message,
    )
  }
  return (
    err.code === 'unregistered_origin' ||
    err.code === 'invalid_client' ||
    err.code === 'script_load_failed'
  )
}

function isLocalDevOrigin() {
  if (typeof window === 'undefined') return false
  const { hostname } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * PWA-safe Google sign-in for local + production.
 *
 * - Installed PWA / localhost: Google Identity Services (ID token) — no
 *   Safari/Chrome cookie split, and localhost origins are usually registered.
 * - Production browser: Supabase OAuth redirect first. That path checks
 *   Authorized redirect URIs (Supabase callback), not JavaScript origins, so
 *   it avoids the common `origin_mismatch` popup on Vercel.
 * - If GIS is used and fails for origin/client reasons, fall back to OAuth
 *   (browser only). Then sync SSR cookies and continue to /auth/finalize.
 */
export async function signInWithGoogleClient(
  nextPath: string,
): Promise<GoogleSignInResult> {
  const clientId = resolveGoogleClientId()
  if (!clientId) {
    return {
      ok: false,
      error:
        'Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and add it under Supabase → Auth → Google → Authorized Client IDs.',
    }
  }

  const supabase = createClient()
  clearIronstackAuthCache()
  await abandonGuestInBrowser(supabase)

  // Production browser: skip GIS so Google never shows origin_mismatch.
  if (!isStandalonePwa() && !isLocalDevOrigin()) {
    return redirectOAuthGoogle(nextPath)
  }

  let idToken: string
  try {
    idToken = await requestGoogleIdToken(clientId)
  } catch (err) {
    if (isGoogleIdentityError(err) && err.code === 'cancelled') {
      return { ok: false, error: err.message, cancelled: true }
    }
    if (shouldFallbackToOAuth(err) && !isStandalonePwa()) {
      return redirectOAuthGoogle(nextPath)
    }
    const message =
      err instanceof Error ? err.message : 'Google sign-in failed.'
    return { ok: false, error: message }
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  })

  if (error) {
    // Audience / provider misconfig on production — try redirect OAuth once.
    if (
      !isStandalonePwa() &&
      /audience|nonce|provider|id token|not enabled/i.test(error.message)
    ) {
      return redirectOAuthGoogle(nextPath)
    }
    return { ok: false, error: error.message }
  }

  const session = data.session
  const user = session?.user ?? data.user
  if (!session?.access_token || !session.refresh_token || !user) {
    return {
      ok: false,
      error: 'Google sign-in succeeded but no session was established.',
    }
  }

  await handleAuthUserChanged(user.id)
  clearIronstackAuthCache()

  try {
    await supabase
      .from('profiles')
      .update({ is_guest: false, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  } catch {
    /* profile flag is best-effort; do not block sign-in */
  }

  const redirectTo = await syncSessionCookies({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    next: nextPath,
  })

  return { ok: true, redirectTo }
}
