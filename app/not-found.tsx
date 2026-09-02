import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('workout')

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16 text-center text-foreground">
      <Dumbbell className="mb-4 size-10 text-gold" aria-hidden="true" />
      <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
        404
      </p>
      <h1 className="font-heading mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        This page doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard/home"
          className="btn-pill btn-pill-primary inline-flex min-h-11 items-center justify-center px-8 text-xs tracking-[0.2em]"
        >
          {t('backToTrain')}
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-6 text-xs font-semibold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
        >
          Home
        </Link>
      </div>
    </main>
  )
}
