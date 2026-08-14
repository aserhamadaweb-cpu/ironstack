import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from '@/lib/i18n'
import { createClient } from '@/lib/supabase/server'

async function resolveLocale(): Promise<AppLocale> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  let locale: AppLocale = isAppLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .maybeSingle()
      if (isAppLocale(data?.language)) {
        locale = data.language
      }
    }
  } catch {
    // Keep cookie/default locale if auth/profile lookup fails.
  }

  return locale
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
