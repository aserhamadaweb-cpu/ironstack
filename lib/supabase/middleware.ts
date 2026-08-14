import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh the auth session and gate /dashboard + /login.
 * Uses headers-only NextResponse.next() — passing the full `request`
 * object into next() can 404 authenticated App Router pages on Next 16.
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

  // Verify JWT (local JWKS when asymmetric keys) + refresh cookies.
  // Prefer getClaims over getUser — getUser hits Auth over the network every request.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  const path = request.nextUrl.pathname
  const isDashboard = path.startsWith('/dashboard')
  const isLogin = path === '/login' || path.startsWith('/login/')
  const isProfile = path.startsWith('/profile')

  if ((isDashboard || isProfile) && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  let emailVerified = false
  let isGuest = false
  if (userId && (isDashboard || isProfile || isLogin)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_email_verified, is_guest')
      .eq('id', userId)
      .maybeSingle()
    emailVerified = profile?.is_email_verified === true
    isGuest = profile?.is_guest === true
  }

  const canUseApp = isGuest || emailVerified

  if ((isDashboard || isProfile) && userId && !canUseApp) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('verify', '1')
    return NextResponse.redirect(url)
  }

  if (isLogin && userId && canUseApp) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/home'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
