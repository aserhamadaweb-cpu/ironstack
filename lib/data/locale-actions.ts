'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { safeAuthNextPath } from '@/lib/safe-next-path'
import {
  isAppLocale,
  LOCALE_CHOSEN_COOKIE,
  LOCALE_COOKIE,
  type AppLocale,
} from '@/lib/i18n'

export async function setInitialLocaleAction(
  language: AppLocale,
  next?: string | null,
  options?: { skipRedirect?: boolean },
) {
  if (!isAppLocale(language)) {
    throw new Error('Invalid locale')
  }

  const jar = await cookies()
  jar.set(LOCALE_COOKIE, language, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  jar.set(LOCALE_CHOSEN_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  if (options?.skipRedirect) {
    return { ok: true as const }
  }

  redirect(safeAuthNextPath(next) ?? '/login')
}
