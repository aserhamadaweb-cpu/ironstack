import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { ReadySplitDetailView } from '@/components/ready-split-views'
import { getProfile } from '@/lib/data/queries'
import { getCuratedRecommendationById } from '@/lib/split-recommendations'
import { RECOMMENDED_SPLITS_PATH } from '@/lib/split-create-paths'
import { getAuthIdentity } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type ReadySplitDetailPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ReadySplitDetailPageProps) {
  const { id } = await params
  const rec = getCuratedRecommendationById(decodeURIComponent(id))
  return {
    title: rec ? `${rec.name} — IRONSTACK` : 'Ready Split — IRONSTACK',
    description: rec?.rationale ?? 'Ready-made training split details.',
  }
}

export default async function ReadySplitDetailPage({
  params,
}: ReadySplitDetailPageProps) {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const { id } = await params
  const recommendation = getCuratedRecommendationById(decodeURIComponent(id))
  if (!recommendation) notFound()

  const t = await getTranslations('splitRecommendations')
  const profileResult = await getProfile(userId)
  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>

      <OfflineConnectionGate feature="splitsManage">
          <main className="mx-auto min-w-0 max-w-2xl space-y-6 overflow-x-clip px-4 py-6 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <BackToTrainLink />
              <Link
                href={RECOMMENDED_SPLITS_PATH}
                className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
              >
                <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
                {t('backToReadySplits')}
              </Link>
            </div>
            <ReadySplitDetailView recommendation={recommendation} />
          </main>
      </OfflineConnectionGate>
    </>
  )
}
