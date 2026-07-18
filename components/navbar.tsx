import Link from 'next/link'
import { Hexagon } from 'lucide-react'

const links = [
  { label: 'AI CONCIERGE', href: '#ai-concierge' },
  { label: 'PR ARENA', href: '#pr-arena' },
  { label: 'THE IRON CIRCLE', href: '#iron-circle' },
  { label: 'MEMBER PORTAL', href: '#member-portal' },
]

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav
        aria-label="Main navigation"
        className="glass-card mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-full border border-silver/20 px-6 py-3"
      >
        <Link href="/" className="flex items-center gap-2">
          <Hexagon className="size-5 text-gold" aria-hidden="true" />
          <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
            IRONSTACK
          </span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-xs font-medium tracking-[0.2em] text-silver-dim transition-colors hover:text-silver"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="#member-portal"
          className="rounded-full border border-gold/40 px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-gold transition-colors hover:bg-gold hover:text-accent-foreground"
        >
          JOIN
        </Link>
      </nav>
    </header>
  )
}
