import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { ResetPasswordClient } from '@/app/login/reset-password/reset-password-client'

export const metadata = {
  title: 'Reset password — IRONSTACK',
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
          <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
        </main>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
