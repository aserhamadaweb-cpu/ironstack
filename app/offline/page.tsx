import Link from 'next/link'
import { Dumbbell } from 'lucide-react'

export const metadata = {
  title: 'Offline — IronStack',
  description: 'You are offline. Reconnect to keep training with IronStack.',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <Dumbbell className="size-10 text-gold" aria-hidden="true" />
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        You&apos;re offline
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        IronStack needs a connection for live training data. Check your network,
        then try again.
      </p>
      <Link
        href="/dashboard/home"
        className="btn-pill btn-pill-primary inline-flex min-h-11 items-center px-8 text-xs tracking-[0.2em]"
      >
        RETRY
      </Link>
    </main>
  )
}
