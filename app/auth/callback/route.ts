import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isAppLocale, LOCALE_COOKIE } from '@/lib/i18n'
import { isThemePreference } from '@/lib/theme'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/dashboard/home'
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard/home'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let localeCookie: string | null = null

      if (user) {
        const meta = user.user_metadata ?? {}
        const metaUsername =
          typeof meta.username === 'string'
            ? meta.username.trim().toLowerCase()
            : ''
        const metaLanguage = isAppLocale(meta.language) ? meta.language : null
        const metaTheme = isThemePreference(meta.theme_preference)
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
          language?: 'en' | 'ar'
          theme_preference?: 'dark' | 'light'
          updated_at: string
        } = { updated_at: new Date().toISOString() }

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
              (typeof meta.display_name === 'string'
                ? meta.display_name
                : null) ||
              user.email?.split('@')[0] ||
              metaUsername
          }
        }

        if (metaLanguage) patch.language = metaLanguage
        if (metaTheme) patch.theme_preference = metaTheme

        await supabase.from('profiles').update(patch).eq('id', user.id)
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const redirectUrl = isLocalEnv
        ? `${origin}${next}`
        : forwardedHost
          ? `https://${forwardedHost}${next}`
          : `${origin}${next}`

      const response = NextResponse.redirect(redirectUrl)
      if (localeCookie) {
        response.cookies.set(LOCALE_COOKIE, localeCookie, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        })
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
