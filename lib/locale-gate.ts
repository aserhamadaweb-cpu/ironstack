import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { LOCALE_CHOSEN_COOKIE, LOCALE_GATE_PATH } from '@/lib/i18n'
import { safeAuthNextPath } from '@/lib/safe-next-path'

/** Server: explicit language choice cookie (not merely ironstack-locale). */
export function hasChosenLocale(request: NextRequest) {
  return request.cookies.get(LOCALE_CHOSEN_COOKIE)?.value === '1'
}

export function isLocaleGatePath(path: string) {
  return path === LOCALE_GATE_PATH
}

function loginWithLanguagePick(
  request: NextRequest,
  loginReturnPath: string,
) {
  const url = new URL(loginReturnPath, request.url)
  if (!url.pathname.startsWith('/login')) {
    url.pathname = '/login'
    const safeNext = safeAuthNextPath(loginReturnPath)
    url.search = ''
    if (safeNext) url.searchParams.set('next', safeNext)
  }
  url.searchParams.set('pickLanguage', '1')
  return url
}

export function loginLocaleGateRedirectUrl(request: NextRequest) {
  const path = request.nextUrl.pathname
  const returnPath = `${path}${request.nextUrl.search}`
  return loginWithLanguagePick(request, returnPath)
}

export function localeGateRedirectUrl(request: NextRequest, returnPath: string) {
  return loginWithLanguagePick(request, returnPath)
}

/** Send unauthenticated visitors to login with language picker first. */
export function redirectToLoginEntry(
  request: NextRequest,
  loginReturnPath: string,
) {
  if (hasChosenLocale(request)) {
    const dest = safeAuthNextPath(loginReturnPath) ?? '/login'
    return NextResponse.redirect(new URL(dest, request.url))
  }
  return NextResponse.redirect(loginWithLanguagePick(request, loginReturnPath))
}
