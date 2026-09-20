import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import LoginPageClient from '@/app/login/login-page-client'
import { isPickLanguageEntry } from '@/lib/auth-entry'
import { LOCALE_CHOSEN_COOKIE } from '@/lib/i18n'
import { createClient, getAuthIdentity } from '@/lib/supabase/server'
import { userNeedsOnboarding } from '@/lib/onboarding-storage'
import { HOME_PATH, ONBOARDING_PATH } from '@/lib/onboarding-types'

type LoginPageProps = {
  searchParams: Promise<{ next?: string; mode?: string; pickLanguage?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { userId } = await getAuthIdentity()
  if (userId) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && !user.is_anonymous) {
      redirect(userNeedsOnboarding(user) ? ONBOARDING_PATH : HOME_PATH)
    }
  }

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
