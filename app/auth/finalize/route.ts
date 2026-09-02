import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAppLocale, LOCALE_COOKIE } from '@/lib/i18n'
import { userNeedsOnboarding } from '@/lib/onboarding-storage'
import { homePathWithTourIfNeeded, buildTourSeedForNewAccount } from '@/lib/app-tour-storage'
import {
  HOME_PATH,
  ONBOARDING_COOKIE,
  ONBOARDING_PATH,
} from '@/lib/onboarding-types'
import { isAppearanceMode, isThemePreference } from '@/lib/theme'
import { isAvatarPresetPath } from '@/lib/avatar-presets'

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
 * Completes post-auth profile/onboarding routing after a session already exists
 * (PKCE exchange on /auth/callback, or hash tokens on /auth/confirm).
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

  if (code) {
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
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const dest = new URL('/auth/error', appOrigin(request))
    dest.searchParams.set('reason', code ? 'no_session' : 'missing_code')
    return NextResponse.redirect(dest)
  }

  let localeCookie: string | null = null
  let redirectPath = next
  const meta = user.user_metadata ?? {}
  const metaUsername =
    typeof meta.username === 'string' ? meta.username.trim().toLowerCase() : ''
  const metaLanguage = isAppLocale(meta.language) ? meta.language : null
  const metaAppearance = isAppearanceMode(meta.appearance)
    ? meta.appearance
    : null
  const metaTheme =
    metaAppearance === 'system'
      ? null
      : isThemePreference(metaAppearance)
        ? metaAppearance
        : isThemePreference(meta.theme_preference)
          ? meta.theme_preference
          : null

  if (metaLanguage) localeCookie = metaLanguage

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  const patch: {
    username?: string
    display_name?: string
    avatar_url?: string
    language?: 'en' | 'ar'
    theme_preference?: 'dark' | 'light' | null
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  const presetAvatar =
    typeof meta.preset_avatar === 'string' ? meta.preset_avatar.trim() : ''

  if (/^[a-z0-9_]{3,30}$/.test(metaUsername) && !profile?.username) {
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', metaUsername)
      .neq('id', user.id)
      .maybeSingle()
    if (!taken) {
      patch.username = metaUsername
      patch.display_name =
        (typeof meta.display_name === 'string' ? meta.display_name : null) ||
        user.email?.split('@')[0] ||
        metaUsername
    }
  }

  if (presetAvatar && isAvatarPresetPath(presetAvatar)) {
    patch.avatar_url = presetAvatar
  }

  if (metaLanguage) patch.language = metaLanguage
  if (metaAppearance === 'system') {
    patch.theme_preference = null
  } else if (metaTheme) {
    patch.theme_preference = metaTheme
  }

  if (Object.keys(patch).length > 1) {
    await supabase.from('profiles').update(patch).eq('id', user.id)
  }

  let needsOnboarding = userNeedsOnboarding(user)
  if (
    !needsOnboarding &&
    meta.onboarding_completed === undefined &&
    meta.onboarding_v1 == null
  ) {
    const createdAt = Date.parse(user.created_at)
    const ageMs = Number.isFinite(createdAt)
      ? Date.now() - createdAt
      : Number.POSITIVE_INFINITY
    if (ageMs < 24 * 60 * 60 * 1000) {
      await supabase.auth.updateUser({
        data: {
          onboarding_completed: false,
          onboarding_step: 1,
          ...buildTourSeedForNewAccount(),
        },
      })
      needsOnboarding = true
    }
  }

  if (needsOnboarding) {
    redirectPath =
      next !== HOME_PATH && next !== ONBOARDING_PATH
        ? `${ONBOARDING_PATH}?next=${encodeURIComponent(next)}`
        : ONBOARDING_PATH
  } else if (next === ONBOARDING_PATH && !needsOnboarding) {
    redirectPath = homePathWithTourIfNeeded(user)
  } else if (!needsOnboarding && redirectPath === HOME_PATH) {
    redirectPath = homePathWithTourIfNeeded(user)
  }

  const response = NextResponse.redirect(
    `${appOrigin(request)}${redirectPath}`,
  )

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options)
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value)
  }

  if (localeCookie) {
    response.cookies.set(LOCALE_COOKIE, localeCookie, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  const {
    data: { user: fresh },
  } = await supabase.auth.getUser()
  const gateUser = fresh ?? user
  if (
    userNeedsOnboarding(gateUser) ||
    gateUser.user_metadata?.onboarding_completed === false
  ) {
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
