import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BrainCircuit, MessageSquare } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { EmptyState } from '@/components/page-states'
import { LtrIsolate } from '@/components/ltr-isolate'
import { listAiInsights } from '@/lib/ai/insights'
import { getOrCreateLatestConversation } from '@/lib/ai/conversations'
import { CTA_PRIMARY } from '@/lib/accent'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { formatSessionDate } from '@/lib/session-store'
import { getAuthIdentity } from '@/lib/supabase/server'

export const metadata = {
  title: 'AI Coach — IRONSTACK',
  description: 'Coaching insights and your training companion chat.',
}

export default async function AiCoachPage() {
  const t = await getTranslations('coach')
  const tCommon = await getTranslations('common')
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, insights] = await Promise.all([
    getProfile(userId),
    listAiInsights(userId, 40),
    getOrCreateLatestConversation(userId).catch((err) => {
      console.error('[ai-coach] ensure conversation', err)
      return null
    }),
  ])

  const displayName =
    profileResult.data?.display_name ||
    email?.split('@')[0] ||
    tCommon('athlete')

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
            <p className="section-kicker">{t('kicker')}</p>
            <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('insightsIntro')}
            </p>
          </div>
          <Link href="/dashboard/ai-coach/chat" className={CTA_PRIMARY}>
            <MessageSquare className="size-4" aria-hidden="true" />
            {t('openChat')}
          </Link>
        </header>

        <section>
          <h2 className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
            {t('insights')}
          </h2>
          {insights.length === 0 ? (
            <EmptyState
              icon={BrainCircuit}
              title={t('noInsights')}
              body={t('noInsightsBody')}
              actionLabel={tCommon('openWorkout')}
              actionHref="/dashboard/workout"
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
    </>
  )
}
