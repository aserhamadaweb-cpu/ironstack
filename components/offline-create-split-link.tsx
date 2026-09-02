'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useOfflineStatus } from '@/lib/offline/provider'

type OfflineCreateSplitLinkProps = {
  href: string
  className: string
  children: ReactNode
}

export function OfflineCreateSplitLink({
  href,
  className,
  children,
}: OfflineCreateSplitLinkProps) {
  const t = useTranslations('offline')
  const { online, hydrated } = useOfflineStatus()
  const offline = hydrated && !online

  if (offline) {
    return (
      <span
        className={`${className} cursor-not-allowed border-dashed opacity-60`}
        title={t('splitRequiresConnection')}
        aria-disabled="true"
      >
        {children}
        <span className="ms-2 text-[10px] font-semibold tracking-normal opacity-80">
          · {t('editSplitNeedsConnection')}
        </span>
      </span>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
