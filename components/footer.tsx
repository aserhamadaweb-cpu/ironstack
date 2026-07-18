import Link from 'next/link'
import { Hexagon } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-silver/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform duration-300 hover:scale-105"
        >
          <Hexagon className="size-4 text-gold" aria-hidden="true" />
          <span className="font-heading text-metallic text-sm font-bold tracking-[0.25em]">
            IRONSTACK
          </span>
        </Link>
        <p className="text-xs tracking-widest text-muted-foreground">
          {'\u00A9'} 2026 IRONSTACK. MADE WITH CARE.
        </p>
        <div className="flex gap-6 text-xs tracking-[0.2em] text-silver-dim">
          <Link
            href="#"
            className="link-underline transition-colors duration-300 hover:text-silver"
          >
            PRIVACY
          </Link>
          <Link
            href="#"
            className="link-underline transition-colors duration-300 hover:text-silver"
          >
            TERMS
          </Link>
        </div>
      </div>
      <div className="border-t border-silver/10 py-4 text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold">
          POWERED BY ASER HAMADA
        </p>
      </div>
    </footer>
  )
}
