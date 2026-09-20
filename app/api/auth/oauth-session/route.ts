import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { finalizeRedirect } from '@/lib/auth/finalize-redirect'
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options'
import { HOME_PATH } from '@/lib/onboarding-types'

type CookieToSet = { name: string; value: string; options: CookieOptions }

function safeNextPath(raw: unknown) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return HOME_PATH
  }
  return raw
}

/**
 * Writes Supabase auth cookies from access/refresh tokens.
 * Used after Google ID-token sign-in (and OAuth hash return) so SSR/middleware
 * see the same session as the browser client.
 *
 * Important: ignore incoming request cookies while applying the new session.
 * Reusing a guest/stale jar caused setSession to 400 on production only.
 */
export async function POST(request: NextRequest) {
  let body: { access_token?: string; refresh_token?: string; next?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const access_token = body.access_token?.trim()
  const refresh_token = body.refresh_token?.trim()
  const next = safeNextPath(body.next)

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing OAuth tokens.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 500 },
    )
  }

  const pendingCookies: CookieToSet[] = []
  const pendingHeaders: Record<string, string> = {}

  const supabase = createServerClient(url, anon, {
    cookies: {
      // Fresh jar — do not merge with guest/previous auth cookies on the request.
      getAll() {
        return pendingCookies.map(({ name, value }) => ({ name, value }))
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          const index = pendingCookies.findIndex((row) => row.name === cookie.name)
          if (index >= 0) pendingCookies[index] = cookie
          else pendingCookies.push(cookie)
        }
        if (headers) Object.assign(pendingHeaders, headers)
      },
    },
    cookieOptions: supabaseCookieOptions,
  })

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })

  if (error || !data.session) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Could not establish a signed-in session from Google tokens.',
      },
      { status: 400 },
    )
  }

  const redirectPath = finalizeRedirect(next)
  const response = NextResponse.json({ redirect: redirectPath })

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options)
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value)
  }

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
