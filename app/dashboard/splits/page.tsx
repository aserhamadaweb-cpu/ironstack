import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Layers, Plus } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { EmptyState } from '@/components/page-states'
import { CTA_PRIMARY } from '@/lib/accent'
import { getProfile, getSplitsForUser } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'My Splits — IRONSTACK',
  description: 'Your training plans and system programs.',
}

export default async function MySplitsPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, splitsResult] = await Promise.all([
    getProfile(userId),
    getSplitsForUser(userId),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'
  const splits = splitsResult.data ?? []
  const mine = splits.filter((s) => s.user_id === userId)
  const system = splits.filter((s) => s.is_system || s.user_id == null)

  return (
    <>
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        profileHref={profileHref(profileResult.data?.username, userId)}
      />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">TRAINING PLANS</p>
            <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
              My Splits
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your custom plans plus system programs available to everyone.
            </p>
          </div>
          <Link href="/dashboard/splits/create" className={CTA_PRIMARY}>
            <Plus className="size-4" aria-hidden="true" />
            CREATE
          </Link>
        </header>

        {splitsResult.error && (
          <p role="alert" className="text-sm text-destructive">
            {splitsResult.error}
          </p>
        )}

        {splits.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No splits yet"
            body="Create a custom split or start from a system program on Workout."
            actionLabel="CREATE SPLIT"
            actionHref="/dashboard/splits/create"
            tone="gold"
          />
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
                YOURS
              </h2>
              {mine.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom splits yet — create one to own your programming.
                </p>
              ) : (
                <ul className="space-y-2">
                  {mine.map((split) => (
                    <li key={split.id}>
                      <Link
                        href={`/dashboard/splits/${split.id}`}
                        className="is-row flex w-full flex-col gap-1 px-4 py-4 text-left"
                      >
                        <p className="font-heading text-base font-semibold text-foreground">
                          {split.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {split.days_per_week} days/week
                          {split.category ? ` · ${split.category}` : ''}
                          {split.is_shared ? ' · Shared' : ''}
                        </p>
                        {split.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {split.description}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
                SYSTEM PROGRAMS
              </h2>
              {system.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No system splits available.
                </p>
              ) : (
                <ul className="space-y-2">
                  {system.map((split) => (
                    <li key={split.id}>
                      <Link
                        href={`/dashboard/splits/${split.id}`}
                        className="is-row flex w-full flex-col gap-1 px-4 py-4 text-left"
                      >
                        <p className="font-heading text-base font-semibold text-foreground">
                          {split.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {split.days_per_week} days/week
                          {split.category ? ` · ${split.category}` : ''}
                          {' · System'}
                        </p>
                        {split.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {split.description}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Open a split to train, share, or edit days and exercises.
        </p>
      </main>
    </>
  )
}
