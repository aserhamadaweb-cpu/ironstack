'use client'

/** Legacy localStorage tokens from pre-SSR clients can shadow cookie sessions. */
export function purgeLegacySupabaseLocalStorage() {
  if (typeof window === 'undefined') return

  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith('sb-')) keys.push(key)
    }
    for (const key of keys) window.localStorage.removeItem(key)
  } catch {
    /* private mode */
  }
}

function purgeSupabaseAuthCookies() {
  if (typeof document === 'undefined') return

  try {
    const projectRef = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    ).hostname.split('.')[0]
    const prefix = `sb-${projectRef}-`
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim()
      if (name && name.startsWith(prefix)) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
      }
    }
  } catch {
    /* ignore */
  }
}

/** Full client auth wipe — only after a detected session mismatch. */
export function purgeSupabaseBrowserAuthStorage() {
  purgeLegacySupabaseLocalStorage()
  purgeSupabaseAuthCookies()
}
