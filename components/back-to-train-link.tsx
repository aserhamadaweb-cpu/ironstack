'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

export const BACK_TO_TRAIN_LINK_CLASS =
  'inline-flex min-h-11 w-fit items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'

type BackToTrainLinkProps = {
  className?: string
}

export function BackToTrainLink({ className }: BackToTrainLinkProps) {
  const t = useTranslations('workout')

  return (
    <Link href="/dashboard/workout" className={className ?? BACK_TO_TRAIN_LINK_CLASS}>
      <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
      {t('backToTrain')}
    </Link>
  )
}
