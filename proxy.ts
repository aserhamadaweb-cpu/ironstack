import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Skip static assets and auth cookie APIs — middleware getClaims on
     * /api/auth/oauth-session raced setSession and caused production 400s.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|api/auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
