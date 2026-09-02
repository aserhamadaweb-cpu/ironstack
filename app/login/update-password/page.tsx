import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { UpdatePasswordClient } from '@/app/login/update-password/update-password-client'

export const metadata = {
  title: 'Update password — IRONSTACK',
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
          <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
        </main>
      }
    >
      <UpdatePasswordClient />
    </Suspense>
  )
}
