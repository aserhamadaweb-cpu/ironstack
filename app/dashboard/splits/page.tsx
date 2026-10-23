import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { MySplitsCustomSection } from '@/components/my-splits-custom-section'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { OfflineCreateSplitLink } from '@/components/offline-create-split-link'
import { CTA_PRIMARY } from '@/lib/accent'
import { getProfile, getSplitsForUser } from '@/lib/data/queries'
import { formatSplitSavedDate, sortSplitsByRecentSaved } from '@/lib/split-display'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import { createSplitChoiceHref } from '@/lib/split-create-paths'
import { getAuthIdentity } from '@/lib/supabase/server'

export async function generateMetadata() {
  const t = await getTranslations('workout')
  return {
    title: `${t('yourSplitsPageTitle')} — IRONSTACK`,
    description: t('yourSplitsPageBody', { max: MAX_CUSTOM_SPLITS }),
  }
}

export default async function MySplitsPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const t = await getTranslations('workout')
  const tCommon = await getTranslations('common')
  const [profileResult, splitsResult] = await Promise.all([
    getProfile(userId),
    getSplitsForUser(userId),
  ])

  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || tCommon('athlete')
  const locale = profileResult.data?.language === 'ar' ? 'ar' : 'en'
  const primarySplitId = profileResult.data?.primary_split_id ?? null

  const splits = splitsResult.data ?? []
  const customSplits = sortSplitsByRecentSaved(
    splits.filter((s) => s.user_id === userId && !s.is_system),
  )

  const customCards = customSplits.map((split) => ({
    id: split.id,
    slug: split.id,
    name: split.name,
    days: split.days_per_week,
    focus: split.category || t('custom'),
    description: split.description,
    isShared: Boolean(split.is_shared),
    savedDate: formatSplitSavedDate(split, locale),
  }))

  return (
    <>

      <OfflineConnectionGate feature="splitsManage">
      <main className="mx-auto min-w-0 max-w-3xl space-y-8 overflow-x-clip px-4 py-6 sm:px-6 sm:py-8">
        <BackToTrainLink />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">{t('yourSplitsKicker')}</p>
            <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
              {t('yourSplitsPageTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('yourSplitsPageBody', { max: MAX_CUSTOM_SPLITS })}
            </p>
          </div>
          <OfflineCreateSplitLink
            href={createSplitChoiceHref()}
            className={`${CTA_PRIMARY} inline-flex min-h-11 shrink-0 items-center gap-2`}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('createSplit')}
          </OfflineCreateSplitLink>
        </header>

        {splitsResult.error ? (
          <p role="alert" className="text-sm text-destructive">
            {splitsResult.error}
          </p>
        ) : null}

        <section>
          <MySplitsCustomSection
            splits={customCards}
            primarySplitId={primarySplitId}
          />
        </section>

        <p className="text-xs text-muted-foreground">{t('mySplitsFooter')}</p>
      </main>
      </OfflineConnectionGate>
    </>
  )
}
