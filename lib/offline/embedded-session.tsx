'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type EmbeddedSessionContextValue = {
  nested: number
  enter: () => void
  leave: () => void
}

const EmbeddedSessionContext = createContext<EmbeddedSessionContextValue | null>(
  null,
)

/** Keeps floor hosts mounted while an inline offline session is open (reconnect). */
export function EmbeddedSessionProvider({ children }: { children: ReactNode }) {
  const [nested, setNested] = useState(0)
  const value = useMemo<EmbeddedSessionContextValue>(
    () => ({
      nested,
      enter: () => setNested((n) => n + 1),
      leave: () => setNested((n) => Math.max(0, n - 1)),
    }),
    [nested],
  )
  return (
    <EmbeddedSessionContext.Provider value={value}>
      {children}
    </EmbeddedSessionContext.Provider>
  )
}

export function useEmbeddedSessionActive() {
  return (useContext(EmbeddedSessionContext)?.nested ?? 0) > 0
}

export function useRegisterEmbeddedSession() {
  const ctx = useContext(EmbeddedSessionContext)
  useEffect(() => {
    if (!ctx) return
    ctx.enter()
    return () => ctx.leave()
    // enter/leave identities change with nested; register once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
