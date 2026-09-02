/** Theme preference stored on profiles: dark | light. Appearance may also be system (metadata). */

export type ThemePreference = 'dark' | 'light'
export type AppearanceMode = 'dark' | 'light' | 'system'

export const THEME_STORAGE_KEY = 'ironstack-theme'
export const APPEARANCE_STORAGE_KEY = 'ironstack-appearance'
export const DEFAULT_THEME: ThemePreference = 'dark'
export const DEFAULT_APPEARANCE: AppearanceMode = 'dark'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light'
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function systemThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  } catch {
    return DEFAULT_THEME
  }
}

export function resolveAppearance(appearance: AppearanceMode): ThemePreference {
  if (appearance === 'system') return systemThemePreference()
  return appearance
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

export function readStoredAppearance(): AppearanceMode {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (isAppearanceMode(raw)) return raw
    return readStoredTheme()
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function writeStoredAppearance(appearance: AppearanceMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
    // Keep a resolved snapshot for FOUC helpers, but System remains the
    // canonical mode in APPEARANCE_STORAGE_KEY.
    if (appearance === 'system') {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolveAppearance('system'))
    } else {
      writeStoredTheme(appearance)
    }
  } catch {
    /* ignore */
  }
}
