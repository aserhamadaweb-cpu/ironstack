import Link from 'next/link'
import { ChevronRight, Layers, Sparkles, Wand2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import {
  AI_SPLIT_BUILDER_PATH,
  manualSplitCreateHref,
  RECOMMENDED_SPLITS_PATH,
} from '@/lib/split-create-paths'

type CreateSplitChoiceProps = {
  homeLibrary?: boolean
}

export async function CreateSplitChoice({
  homeLibrary = false,
}: CreateSplitChoiceProps) {
  const t = await getTranslations('createSplitChoice')
  const manualHref = manualSplitCreateHref(homeLibrary)

  const options = [
    {
      href: manualHref,
      icon: Layers,
      title: t('manualTitle'),
      body: t('manualBody'),
    },
    {
      href: AI_SPLIT_BUILDER_PATH,
      icon: Wand2,
      title: t('aiTitle'),
      body: t('aiBody'),
    },
    {
      href: RECOMMENDED_SPLITS_PATH,
      icon: Sparkles,
      title: t('recommendedTitle'),
      body: t('recommendedBody'),
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-3" data-tour="create-split-choice">
      {options.map(({ href, icon: Icon, title, body }) => (
        <Link
          key={href}
          href={href}
          data-tour={
            href === RECOMMENDED_SPLITS_PATH
              ? 'create-split-recommended'
              : undefined
          }
          className="group flex min-h-[11rem] flex-col rounded-2xl border border-silver/25 bg-card p-5 shadow-sm transition hover:border-gold/45 hover:bg-gold/5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:p-6"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="font-heading mt-4 text-lg font-bold text-foreground group-hover:text-gold">
            {title}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {body}
          </span>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold tracking-[0.12em] text-gold">
            {t('continue')}
            <ChevronRight className="size-3.5 rtl-flip" aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  )
}
