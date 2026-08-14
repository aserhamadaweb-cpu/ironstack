import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { BrandSocialLinks } from '@/components/brand-social-links'

export async function Footer() {
  const t = await getTranslations('legal')

  return (
    <footer className="border-t border-silver/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform duration-300 hover:scale-105"
        >
          <Dumbbell className="size-4 text-gold" aria-hidden="true" />
          <span className="font-heading text-metallic text-sm font-bold tracking-[0.25em]">
            IRONSTACK
          </span>
        </Link>
        <p className="text-xs tracking-widest text-muted-foreground">
          {t('footerCopyright')}
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <BrandSocialLinks
            iconClassName="size-5"
            buttonClassName="size-11 rounded-lg"
          />
          <div className="flex gap-6 text-xs tracking-[0.2em] text-silver-dim">
            <Link
              href="/privacy"
              className="link-underline transition-colors duration-300 hover:text-silver"
            >
              {t('privacyNav')}
            </Link>
            <Link
              href="/terms"
              className="link-underline transition-colors duration-300 hover:text-silver"
            >
              {t('termsNav')}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-silver/10 py-4 text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold">
          {t('footerPowered')}
        </p>
      </div>
    </footer>
  )
}
