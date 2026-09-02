import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Loader2 } from 'lucide-react'
import LoginPageClient from '@/app/login/login-page-client'
import { isPickLanguageEntry } from '@/lib/auth-entry'
import { LOCALE_CHOSEN_COOKIE } from '@/lib/i18n'

type LoginPageProps = {
  searchParams: Promise<{ next?: string; mode?: string; pickLanguage?: string }>
}

// Signed-in visitors are redirected away from /login by proxy.ts — no extra
// Auth round-trip here so the sign-in screen paints immediately.
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const jar = await cookies()
  const hasChosen = jar.get(LOCALE_CHOSEN_COOKIE)?.value === '1'
  const pickLanguage = isPickLanguageEntry(params.pickLanguage)
  const needsLanguageGate = pickLanguage || !hasChosen

  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
          <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
        </main>
      }
    >
      <LoginPageClient needsLanguageGate={needsLanguageGate} />
    </Suspense>
  )
}
