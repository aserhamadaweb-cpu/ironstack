import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { identityFromCookieList } from '@/lib/supabase/stored-user-id'
import { ONBOARDING_COOKIE, ONBOARDING_PATH, HOME_PATH } from '@/lib/onboarding-types'
import {
  hasChosenLocale,
  isLocaleGatePath,
  redirectToLoginEntry,
} from '@/lib/locale-gate'
import { isPickLanguageEntry } from '@/lib/auth-entry'

function isAnonymousFromClaims(
  claims: Record<string, unknown> | undefined,
): boolean {
  if (!claims) return false
  if (claims.is_anonymous === true) return true
  const meta = claims.user_metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return (meta as Record<string, unknown>).is_guest === true
  }
  return false
}

/**
 * Refresh the auth session and gate /dashboard, /profile, /onboarding, /login.
 * Incomplete onboarding is tracked via a lightweight cookie (no DB schema change).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let userId: string | null = null
  let claimsOnboardingIncomplete: boolean | null = null
  let authClaims: Record<string, unknown> | undefined
  try {
    const { data: claimsData } = await supabase.auth.getClaims()
    authClaims = claimsData?.claims as Record<string, unknown> | undefined
    userId =
      typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    const meta = (claimsData?.claims as { user_metadata?: Record<string, unknown> } | undefined)
      ?.user_metadata
    if (meta && 'onboarding_completed' in meta) {
      claimsOnboardingIncomplete = meta.onboarding_completed === false
    }
  } catch {
    userId = null
  }
  if (!userId) {
    userId = identityFromCookieList(request.cookies.getAll())?.userId ?? null
  }

  const path = request.nextUrl.pathname
  // Auth callback must establish cookies before any login redirect runs.
  if (path.startsWith('/auth/')) {
    return supabaseResponse
  }

  const isLoginEntry = path === '/login'

  if (isLocaleGatePath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('pickLanguage', '1')
    const next = request.nextUrl.searchParams.get('next')
    if (next) url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (
    !userId &&
    isLoginEntry &&
    !hasChosenLocale(request) &&
    !isPickLanguageEntry(request.nextUrl.searchParams.get('pickLanguage'))
  ) {
    const url = request.nextUrl.clone()
    url.searchParams.set('pickLanguage', '1')
    return NextResponse.redirect(url)
  }

  const isDashboard = path.startsWith('/dashboard')
  const isOnboarding =
    path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}/`)
  const isProfile = path.startsWith('/profile')
  const cookieNeeds = request.cookies.get(ONBOARDING_COOKIE)?.value === '1'
  // Prefer JWT metadata when present so a cleared cookie cannot bypass the gate.
  const needsOnboarding =
    claimsOnboardingIncomplete === true ||
    (claimsOnboardingIncomplete === null && cookieNeeds)

  if ((isDashboard || isProfile || isOnboarding) && !userId) {
    const returnPath = `${path}${request.nextUrl.search}`
    const loginReturn = `/login?next=${encodeURIComponent(returnPath)}`
    return redirectToLoginEntry(request, loginReturn)
  }

  if (isLoginEntry && userId) {
    let isAnonymous = isAnonymousFromClaims(authClaims)
    if (!isAnonymous) {
      try {
        const { data: userData } = await supabase.auth.getUser()
        isAnonymous = userData.user?.is_anonymous === true
      } catch {
        isAnonymous = false
      }
    }

    // Guests keep an anonymous Supabase session — they must reach /login to upgrade.
    if (!isAnonymous) {
      const url = request.nextUrl.clone()
      url.pathname = needsOnboarding ? ONBOARDING_PATH : HOME_PATH
      url.search = ''
      const response = NextResponse.redirect(url)
      if (needsOnboarding) {
        response.cookies.set(ONBOARDING_COOKIE, '1', {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        })
      } else {
        response.cookies.set(ONBOARDING_COOKIE, '', {
          path: '/',
          maxAge: 0,
          sameSite: 'lax',
        })
      }
      return response
    }
  }

  // Incomplete onboarding: keep users on the wizard, but never trap them if
  // they only need settings surfaces.
  if (
    userId &&
    needsOnboarding &&
    isDashboard &&
    !path.startsWith('/dashboard/settings')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = ONBOARDING_PATH
    url.search = ''
    const response = NextResponse.redirect(url)
    response.cookies.set(ONBOARDING_COOKIE, '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return response
  }

  // Align cookie when JWT says onboarding is done but the gate cookie is stale.
  if (userId && claimsOnboardingIncomplete === false && cookieNeeds) {
    supabaseResponse.cookies.set(ONBOARDING_COOKIE, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
    })
  }

  // If the gate cookie is stale (completed users), let /onboarding clear it.
  return supabaseResponse
}
