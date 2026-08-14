import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { CTA_PRIMARY, CTA_SECONDARY } from '@/lib/accent'

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Loader2 className="size-7 animate-spin text-gold" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function PageError({
  title = 'Something went wrong',
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
      <AlertCircle className="size-7 text-destructive" aria-hidden="true" />
      <p className="font-heading text-lg font-semibold text-headline">{title}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  body: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  tone?: 'gold' | 'heat' | 'silver'
}

/** Shared empty state — designed, not a blank dashed box. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
  tone = 'gold',
}: EmptyStateProps) {
  const toneClass =
    tone === 'heat'
      ? 'border-heat/30 bg-heat-tint text-heat'
      : tone === 'silver'
        ? 'border-silver/25 bg-background/60 text-silver'
        : 'border-gold/30 bg-gold-tint text-gold'

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-background/40 px-6 py-12 text-center">
      <div
        className={`mb-4 flex size-12 items-center justify-center rounded-xl border ${toneClass}`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <p className="font-heading text-lg font-semibold text-headline">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`mt-6 ${CTA_PRIMARY}`}>
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button type="button" onClick={onAction} className={`mt-6 ${CTA_SECONDARY}`}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
