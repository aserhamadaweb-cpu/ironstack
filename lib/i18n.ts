/** App locales — stored on profiles.language and ironstack-locale cookie. */

export const locales = ['en', 'ar'] as const
export type AppLocale = (typeof locales)[number]
export const DEFAULT_LOCALE: AppLocale = 'en'
export const LOCALE_COOKIE = 'ironstack-locale'
export const LOCALE_STORAGE_KEY = 'ironstack-locale'

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'ar'
}

export function localeDir(locale: AppLocale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

/** Apply locale to the document immediately (login/settings pickers). */
export function applyLocaleToDocument(locale: AppLocale) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = locale
  root.dir = localeDir(locale)
  root.dataset.locale = locale
  document.body.classList.toggle('font-arabic', locale === 'ar')
  document.body.classList.toggle('font-sans', locale !== 'ar')
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}
