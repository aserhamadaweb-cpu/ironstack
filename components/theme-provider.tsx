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
import { updateThemePreferenceAction } from '@/lib/data/theme-actions'
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isThemePreference,
  readStoredTheme,
  writeStoredTheme,
  type ThemePreference,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
  pending: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: ReactNode
  /** Server-known preference for signed-in users (overrides localStorage once). */
  initialTheme?: ThemePreference | null
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (isThemePreference(initialTheme)) return initialTheme
    return DEFAULT_THEME
  })
  const [pending, startTransition] = useTransition()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readStoredTheme()
    const next = isThemePreference(initialTheme) ? initialTheme : stored
    setThemeState(next)
    applyThemeToDocument(next)
    writeStoredTheme(next)
    setHydrated(true)
  }, [initialTheme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    applyThemeToDocument(next)
    writeStoredTheme(next)
    startTransition(async () => {
      await updateThemePreferenceAction(next)
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, pending }),
    [theme, setTheme, toggleTheme, pending],
  )

  return (
    <ThemeContext.Provider value={value}>
      {/* Avoid flash of wrong icon before hydration sync */}
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
