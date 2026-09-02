import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userNeedsOnboarding } from '@/lib/onboarding-storage'
import { homePathWithTourIfNeeded } from '@/lib/app-tour-storage'
import {
  HOME_PATH,
  ONBOARDING_COOKIE,
  ONBOARDING_PATH,
} from '@/lib/onboarding-types'

/**
 * Clears or sets the onboarding gate cookie, then redirects.
 * Cookie writes must live in a Route Handler (not a Server Component).
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=${ONBOARDING_PATH}`)
  }

  if (user.is_anonymous) {
    const response = NextResponse.redirect(`${origin}${HOME_PATH}`)
    response.cookies.set(ONBOARDING_COOKIE, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
    })
    return response
  }

  if (userNeedsOnboarding(user)) {
    const response = NextResponse.redirect(`${origin}${ONBOARDING_PATH}`)
    response.cookies.set(ONBOARDING_COOKIE, '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return response
  }

  const response = NextResponse.redirect(
    `${origin}${homePathWithTourIfNeeded(user)}`,
  )
  response.cookies.set(ONBOARDING_COOKIE, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  })
  return response
}
