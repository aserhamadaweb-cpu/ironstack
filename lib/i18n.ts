/** App locales — stored on profiles.language and ironstack-locale cookie. */

export const locales = ['en', 'ar'] as const
export type AppLocale = (typeof locales)[number]
export const DEFAULT_LOCALE: AppLocale = 'en'
export const LOCALE_COOKIE = 'ironstack-locale'
export const LOCALE_STORAGE_KEY = 'ironstack-locale'
/** Set when the visitor explicitly picks a language on first launch. */
export const LOCALE_CHOSEN_COOKIE = 'ironstack-locale-chosen'
export const LOCALE_CHOSEN_STORAGE_KEY = 'ironstack-locale-chosen'

export const LOCALE_GATE_PATH = '/choose-language'

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

/** Persist explicit language choice on this device (localStorage mirror). */
export function markLocaleChosen(locale: AppLocale) {
  applyLocaleToDocument(locale)
  try {
    localStorage.setItem(LOCALE_CHOSEN_STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Client-only: has the visitor already picked a language on this device? */
export function hasChosenLocaleClient(): boolean {
  if (typeof document === 'undefined') return false
  try {
    if (localStorage.getItem(LOCALE_CHOSEN_STORAGE_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  return document.cookie.split(';').some((part) => {
    const [name, value] = part.trim().split('=')
    return name === LOCALE_CHOSEN_COOKIE && value === '1'
  })
}
