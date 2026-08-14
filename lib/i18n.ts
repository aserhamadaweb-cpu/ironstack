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
