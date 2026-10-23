import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ExerciseProgressDetail } from '@/components/exercise-progress-detail'
import { PageError } from '@/components/page-states'
import { getLiftProgressHistory, getProfile } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'

type ProgressDetailPageProps = {
  params: Promise<{ liftTypeId: string }>
}

export async function generateMetadata({ params }: ProgressDetailPageProps) {
  const { liftTypeId } = await params
  const { userId } = await getAuthIdentity()
  if (!userId) {
    return { title: 'Progress — IRONSTACK' }
  }
  const result = await getLiftProgressHistory(
    userId,
    decodeURIComponent(liftTypeId),
  )
  const name = result.data?.meta?.name
  return {
    title: name ? `${name} — Progress — IRONSTACK` : 'Progress — IRONSTACK',
    description: name
      ? `History and improvement for ${name}.`
      : 'Exercise progress details.',
  }
}

export default async function ProgressDetailPage({
  params,
}: ProgressDetailPageProps) {
  const t = await getTranslations('progress')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const { liftTypeId } = await params
  const id = decodeURIComponent(liftTypeId)

  const [profileResult, historyResult] = await Promise.all([
    getProfile(userId),
    getLiftProgressHistory(userId, id),
  ])

  if (!historyResult.error && !historyResult.data?.meta) {
    notFound()
  }

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')
  const unit = profileResult.data?.preferred_unit === 'lb' ? 'lb' : 'kg'
  const meta = historyResult.data?.meta
  const logs = historyResult.data?.logs ?? []

  return (
    <>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {historyResult.error ? (
          <PageError message={historyResult.error} />
        ) : !meta ? (
          <PageError message={t('notFound')} />
        ) : (
          <ExerciseProgressDetail meta={meta} logs={logs} unit={unit} />
        )}
      </main>
    </>
  )
}
