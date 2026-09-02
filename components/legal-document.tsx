import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { buildAuthEntryHref } from '@/lib/auth-entry'

type LegalDocumentProps = {
  title: string
  updated: string
  children: ReactNode
}

const EMAIL = 'iron.stack.web@gmail.com'

export function LegalEmailLink() {
  return (
    <a
      href={`mailto:${EMAIL}`}
      className="font-medium text-gold underline-offset-2 hover:underline ltr-isolate"
      dir="ltr"
    >
      {EMAIL}
    </a>
  )
}

export async function LegalDocument({
  title,
  updated,
  children,
}: LegalDocumentProps) {
  const t = await getTranslations('legal')

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(198,40,40,0.14),transparent_60%)]"
        aria-hidden="true"
      />

      <header className="relative border-b border-silver/10">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Dumbbell className="size-5 text-gold" aria-hidden="true" />
            <span className="font-heading text-metallic text-sm font-bold tracking-[0.2em]">
              IRONSTACK
            </span>
          </Link>
          <Link
            href={buildAuthEntryHref()}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
          >
            {t('joinUs')}
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 py-12 text-start sm:py-16">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
          {t('kicker')}
        </p>
        <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-headline sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{updated}</p>

        <article className="legal-prose mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          {children}
        </article>
      </main>

      <footer className="relative border-t border-silver/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs tracking-[0.16em] text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1.5 transition hover:text-gold">
            <span className="rtl-flip inline-block" aria-hidden="true">
              ←
            </span>
            {t('home')}
          </Link>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition hover:text-gold">
              {t('privacyNav')}
            </Link>
            <Link href="/terms" className="transition hover:text-gold">
              {t('termsNav')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function LegalSection({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        <span className="text-gold ltr-isolate" dir="ltr">
          {number}.
        </span>{' '}
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 ps-5 marker:text-gold/80">{children}</ul>
  )
}
