import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { MessageSquare, ScrollText } from 'lucide-react'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { EmptyState } from '@/components/page-states'
import { LtrIsolate } from '@/components/ltr-isolate'
import { listAiInsights } from '@/lib/ai/insights'
import { getOrCreateLatestConversation } from '@/lib/ai/conversations'
import { CTA_PRIMARY } from '@/lib/accent'
import { countCompletedSessions, getProfile } from '@/lib/data/queries'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import {
  completenessFromOnboarding,
  getMissingProfileFields,
} from '@/lib/profile-completeness'
import { ProfileCompletenessBanner } from '@/components/profile-completeness-banner'
import { formatSessionDate } from '@/lib/session-store'
import { createClient, getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'AI Coach — IRONSTACK',
  description: 'Coaching insights and your training companion chat.',
}

export default async function AiCoachPage() {
  const t = await getTranslations('coach')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, insights, trainedResult] = await Promise.all([
    getProfile(userId),
    listAiInsights(userId, 40),
    countCompletedSessions(userId),
    getOrCreateLatestConversation(userId).catch((err) => {
      console.error('[ai-coach] ensure conversation', err)
      return null
    }),
  ])

  const displayName =
    profileResult.data?.display_name ||
    email?.split('@')[0] ||
    tCommon('athlete')

  let profileMissingCount = 0
  let profileMissingLabels: string[] = []
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const profile = profileResult.data
    if (user && profile) {
      const onboarding = onboardingDataFromUser(user, profile)
      const missing = getMissingProfileFields(
        completenessFromOnboarding(onboarding, {
          weightKg:
            profile.current_weight_kg != null
              ? Number(profile.current_weight_kg)
              : onboarding.weightKg,
          heightCm: profile.height_cm ?? onboarding.heightCm,
          gender: profile.gender ?? onboarding.gender,
          birthDate: profile.birth_date,
        }),
      )
      profileMissingCount = missing.length
      profileMissingLabels = missing
    }
  } catch {
    /* ignore */
  }

  return (
    <>

      <OfflineConnectionGate feature="coach">
      <GuestPageGate reason="aiCoach" returnPath="/dashboard/ai-coach">
      <main
        data-tour="page-coach"
        className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8"
      >
        <BackToTrainLink />
        <ProfileCompletenessBanner
          missingCount={profileMissingCount}
          missingLabels={profileMissingLabels}
          hasTrained={(trainedResult.data ?? 0) > 0}
        />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">{t('kicker')}</p>
            <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('insightsIntro')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/ai-coach/chat"
              className={CTA_PRIMARY}
              data-tour="coach-chat"
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              {t('openChat')}
            </Link>
            <Link
              href="/dashboard/ai-coach/activity"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <ScrollText className="size-4" aria-hidden="true" />
              {t('activityView')}
            </Link>
          </div>
        </header>

        <section>
          <h2 className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
            {t('insights')}
          </h2>
          {insights.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t('noInsights')}
              body={t('noInsightsBody')}
              actionLabel={t('openChat')}
              actionHref="/dashboard/ai-coach/chat"
              tone="gold"
            />
          ) : (
            <ul className="space-y-3">
              {insights.map((insight) => (
                <li
                  key={insight.id}
                  className="is-panel accent-edge-amber p-4 sm:p-5"
                >
                  <LtrIsolate
                    as="p"
                    className="text-[10px] font-semibold tracking-[0.2em] text-gold"
                  >
                    {formatSessionDate(insight.generated_at)}
                  </LtrIsolate>
                  <h3 className="font-heading mt-1 text-lg font-semibold text-headline">
                    {insight.headline}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {insight.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      </GuestPageGate>
      </OfflineConnectionGate>
    </>
  )
}
