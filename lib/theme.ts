/** Theme preference: stored on profiles + localStorage for guests. */

export type ThemePreference = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'ironstack-theme'
export const DEFAULT_THEME: ThemePreference = 'dark'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light'
}

export function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0E0E10' : '#F7F6F3')
  }
}

export function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function writeStoredTheme(theme: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore quota / private mode */
  }
}
