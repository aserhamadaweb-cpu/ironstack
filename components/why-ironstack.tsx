import { Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { buildAuthEntryHref } from '@/lib/auth-entry'

export function WhyIronStack() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 md:py-28">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Dumbbell className="size-8 text-gold" aria-hidden="true" />
        <p className="text-xs font-medium tracking-[0.4em] text-gold">
          WHY IRONSTACK
        </p>
        <h2 className="font-heading text-metallic text-balance text-3xl font-bold md:text-4xl">
          BUILT FOR REAL TRAINING DAYS
        </h2>
      </div>
      <ul className="space-y-4 text-base leading-relaxed text-muted-foreground md:text-lg">
        <li className="is-row px-4 py-3.5">
          Log sessions the way you actually train — splits, sets, cardio
          duration, PRs, and streaks in one place.
        </li>
        <li className="is-row px-4 py-3.5">
          Stay accountable with challenges, DMs, and group chats — not a
          social feed that distracts you from the bar.
        </li>
        <li className="is-row px-4 py-3.5">
          Get AI coaching grounded in <em>your</em> history, then install the
          app to your home screen so it opens like a native gym companion.
        </li>
      </ul>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already training with us?{' '}
        <Link
          href={buildAuthEntryHref()}
          className="font-semibold text-gold underline-offset-4 active:opacity-80"
        >
          Sign in
        </Link>
      </p>
    </section>
  )
}
