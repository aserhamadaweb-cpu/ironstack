import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { HOME_PATH } from '@/lib/onboarding-types'

type CookieToSet = { name: string; value: string; options: CookieOptions }

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return HOME_PATH
  }
  return raw
}

function appOrigin(request: NextRequest) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  if (isLocalEnv) return url.origin
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${forwardedHost}`
  }
  return url.origin
}

/**
 * Server-side PKCE exchange for OAuth links (?code=…).
 * The code verifier lives in cookies set when the flow started — exchanging
 * here (not in a client page) avoids "PKCE code verifier not found" errors.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))
  const oauthError = searchParams.get('error')
  const oauthErrorDescription = searchParams.get('error_description')

  if (oauthError) {
    const dest = new URL('/auth/error', appOrigin(request))
    dest.searchParams.set(
      'reason',
      oauthError === 'access_denied' ||
        (oauthErrorDescription || '').toLowerCase().includes('expired')
        ? 'expired'
        : 'callback_failed',
    )
    if (oauthErrorDescription) {
      dest.searchParams.set('detail', oauthErrorDescription.slice(0, 280))
    }
    return NextResponse.redirect(dest)
  }

  // Hash tokens (#access_token=…) never reach the server — hand off to /auth/confirm.
  if (!code) {
    const confirm = new URL('/auth/confirm', appOrigin(request))
    searchParams.forEach((value, key) => {
      if (key !== 'code') confirm.searchParams.set(key, value)
    })
    return NextResponse.redirect(confirm)
  }

  const pendingCookies: CookieToSet[] = []
  const pendingHeaders: Record<string, string> = {}

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            pendingCookies.push({ name, value, options })
          })
          if (headers) Object.assign(pendingHeaders, headers)
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const dest = new URL('/auth/error', appOrigin(request))
    const lower = error.message.toLowerCase()
    dest.searchParams.set(
      'reason',
      lower.includes('expired') || lower.includes('invalid')
        ? 'expired'
        : 'exchange_failed',
    )
    dest.searchParams.set('detail', error.message.slice(0, 280))
    return NextResponse.redirect(dest)
  }

  const finalize = new URL('/auth/finalize', appOrigin(request))
  finalize.searchParams.set('next', next)

  const response = NextResponse.redirect(finalize.href)
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options)
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value)
  }

  return response
}
