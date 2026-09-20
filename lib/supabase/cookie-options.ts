import type { CookieOptions } from '@supabase/ssr'

/** Shared auth cookie defaults — `secure` helps iOS PWA session persistence on HTTPS. */
export const supabaseCookieOptions: CookieOptions = {
  ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
}
