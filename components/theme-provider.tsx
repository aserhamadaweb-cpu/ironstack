'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { updateAppearanceAction } from '@/lib/data/onboarding-actions'
import {
  applyThemeToDocument,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  isAppearanceMode,
  isThemePreference,
  readStoredAppearance,
  resolveAppearance,
  writeStoredAppearance,
  type AppearanceMode,
  type ThemePreference,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: ThemePreference
  appearance: AppearanceMode
  setTheme: (theme: ThemePreference) => void
  setAppearance: (appearance: AppearanceMode) => void
  /** Apply appearance in the UI without persisting (onboarding preview). */
  previewAppearance: (appearance: AppearanceMode) => void
  toggleTheme: () => void
  pending: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: ReactNode
  /** Server-known preference for signed-in users (overrides localStorage once). */
  initialTheme?: ThemePreference | null
  initialAppearance?: AppearanceMode | null
}

function resolveInitialAppearance(
  initialAppearance: AppearanceMode | null | undefined,
  initialTheme: ThemePreference | null | undefined,
): AppearanceMode {
  if (isAppearanceMode(initialAppearance)) return initialAppearance
  if (typeof window !== 'undefined') {
    const stored = readStoredAppearance()
    if (isAppearanceMode(stored)) return stored
  }
  if (isThemePreference(initialTheme)) return initialTheme
  return DEFAULT_APPEARANCE
}

export function ThemeProvider({
  children,
  initialTheme,
  initialAppearance,
}: ThemeProviderProps) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>(() =>
    resolveInitialAppearance(initialAppearance, initialTheme),
  )
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const mode = resolveInitialAppearance(initialAppearance, initialTheme)
    if (mode === 'system') {
      return isThemePreference(initialTheme) ? initialTheme : DEFAULT_THEME
    }
    return mode
  })
  const [pending, startTransition] = useTransition()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Prefer explicit server appearance, then localStorage.
    // Never let a stale profile theme_preference override System.
    const storedAppearance = readStoredAppearance()
    let nextAppearance: AppearanceMode
    if (isAppearanceMode(initialAppearance)) {
      nextAppearance = initialAppearance
    } else if (isAppearanceMode(storedAppearance)) {
      nextAppearance = storedAppearance
    } else if (isThemePreference(initialTheme)) {
      nextAppearance = initialTheme
    } else {
      nextAppearance = DEFAULT_APPEARANCE
    }
    const nextTheme = resolveAppearance(nextAppearance)
    setAppearanceState(nextAppearance)
    setThemeState(nextTheme)
    applyThemeToDocument(nextTheme)
    writeStoredAppearance(nextAppearance)
    setHydrated(true)
  }, [initialAppearance, initialTheme])

  useEffect(() => {
    if (appearance !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      const next = resolveAppearance('system')
      setThemeState(next)
      applyThemeToDocument(next)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [appearance])

  const previewAppearance = useCallback((next: AppearanceMode) => {
    const resolved = resolveAppearance(next)
    setAppearanceState(next)
    setThemeState(resolved)
    applyThemeToDocument(resolved)
    writeStoredAppearance(next)
  }, [])

  const setAppearance = useCallback((next: AppearanceMode) => {
    const resolved = resolveAppearance(next)
    setAppearanceState(next)
    setThemeState(resolved)
    applyThemeToDocument(resolved)
    writeStoredAppearance(next)
    startTransition(async () => {
      // Single write path: metadata appearance + resolved profile theme.
      await updateAppearanceAction(next)
    })
  }, [])

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setAppearance(next)
    },
    [setAppearance],
  )

  const toggleTheme = useCallback(() => {
    setAppearance(theme === 'dark' ? 'light' : 'dark')
  }, [setAppearance, theme])

  const value = useMemo(
    () => ({
      theme,
      appearance,
      setTheme,
      setAppearance,
      previewAppearance,
      toggleTheme,
      pending,
    }),
    [
      theme,
      appearance,
      setTheme,
      setAppearance,
      previewAppearance,
      toggleTheme,
      pending,
    ],
  )

  return (
    <ThemeContext.Provider value={value}>
      <span className="sr-only" aria-hidden={!hydrated}>
        Theme {theme}
      </span>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
