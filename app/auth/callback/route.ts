import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/dashboard/home'
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard/home'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Apply username from signup metadata when profile still lacks one.
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const metaUsername =
          typeof user.user_metadata?.username === 'string'
            ? user.user_metadata.username.trim().toLowerCase()
            : ''
        if (/^[a-z0-9_]{3,30}$/.test(metaUsername)) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle()
          if (!profile?.username) {
            const { data: taken } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', metaUsername)
              .neq('id', user.id)
              .maybeSingle()
            if (!taken) {
              await supabase
                .from('profiles')
                .update({
                  username: metaUsername,
                  display_name:
                    (typeof user.user_metadata?.display_name === 'string'
                      ? user.user_metadata.display_name
                      : null) ||
                    user.email?.split('@')[0] ||
                    metaUsername,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', user.id)
            }
          }
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
