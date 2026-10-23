import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { ExerciseProgressList } from '@/components/exercise-progress-list'
import { PageError } from '@/components/page-states'
import { ProgressOverviewPanel } from '@/components/progress-overview'
import { getPracticedLifts, getProfile, getProgressOverview } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'Progress — IRONSTACK',
  description:
    'How your training is moving, muscle by muscle, and progress for each exercise.',
}

export default async function ProgressPage() {
  const t = await getTranslations('progress')
  const { userId } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, overviewResult, liftsResult] = await Promise.all([
    getProfile(userId),
    getProgressOverview(userId),
    getPracticedLifts(userId),
  ])

  const unit = profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-6 sm:px-6 sm:py-8">
      <BackToTrainLink />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-3xl font-bold text-headline sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        <Link
          href="/dashboard/history"
          className="btn-pill btn-pill-secondary inline-flex h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-semibold"
        >
          <History className="size-4" aria-hidden="true" />
          {t('openHistory')}
        </Link>
      </header>

      {overviewResult.error ? (
        <PageError message={overviewResult.error} />
      ) : overviewResult.data ? (
        <ProgressOverviewPanel overview={overviewResult.data} unit={unit} />
      ) : null}

      <section id="progress-exercises" className="scroll-mt-24 space-y-4">
        <div>
          <p className="section-kicker">{t('exercisesKicker')}</p>
          <h2 className="font-heading mt-1 text-xl font-bold text-headline sm:text-2xl">
            {t('exercisesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('exercisesBody')}</p>
        </div>
        {liftsResult.error ? (
          <PageError message={liftsResult.error} />
        ) : (
          <ExerciseProgressList lifts={liftsResult.data ?? []} unit={unit} />
        )}
      </section>
    </main>
  )
}
