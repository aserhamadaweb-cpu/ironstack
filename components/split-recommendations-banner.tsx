import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getAuthIdentity } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/queries'
import { resolveSplitRecommendations } from '@/lib/data/split-recommendations-server'

export async function SplitRecommendationsBanner() {
  const { userId } = await getAuthIdentity()
  if (!userId) return null

  const t = await getTranslations('splitRecommendations')
  const [profile, bundle] = await Promise.all([
    getProfile(userId),
    resolveSplitRecommendations(),
  ])

  if (!bundle.input) return null

  const hasPrimary = Boolean(profile.data?.primary_split_id)

  return (
    <Link
      href="/dashboard/splits/recommendations"
      className="group flex min-h-11 items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-4 transition hover:border-gold/50 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
    >
      <span
        data-tour="workout-recommendations-link"
        data-tour-spotlight="icon"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold"
      >
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="rec-copy block text-sm font-semibold text-foreground group-hover:text-gold">
          {hasPrimary ? t('bannerTitleWithPrimary') : t('bannerTitle')}
        </span>
        <span className="rec-copy mt-0.5 block text-xs text-muted-foreground">
          {hasPrimary ? t('bannerBodyWithPrimary') : t('bannerBody')}
        </span>
      </span>
      <ChevronRight
        className="mt-0.5 size-5 shrink-0 text-muted-foreground transition group-hover:text-gold rtl-flip"
        aria-hidden="true"
      />
    </Link>
  )
}
