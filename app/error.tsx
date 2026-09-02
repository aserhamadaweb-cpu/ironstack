'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, Dumbbell } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app-error]', error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16 text-center text-foreground">
      <Dumbbell className="mb-4 size-10 text-gold" aria-hidden="true" />
      <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
        ERROR
      </p>
      <h1 className="font-heading mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Try again or head back to training.
      </p>
      <div
        role="alert"
        className="mt-6 flex max-w-md items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-start text-sm text-muted-foreground"
      >
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <p>We&apos;ve logged this issue. If it keeps happening, sign out and back in.</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-pill btn-pill-primary inline-flex min-h-11 items-center justify-center px-8 text-xs tracking-[0.2em]"
        >
          Try again
        </button>
        <Link
          href="/dashboard/home"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-6 text-xs font-semibold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
        >
          Back to train
        </Link>
      </div>
    </main>
  )
}
