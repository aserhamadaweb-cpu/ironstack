'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Dumbbell, Home, Menu, User, X } from 'lucide-react'

type DashboardNavProps = {
  userName?: string
  initials?: string
}

const navLinks = [
  { href: '/dashboard/home', label: 'HOME', icon: Home },
  { href: '/dashboard/workout', label: 'WORKOUT', icon: ClipboardList },
  { href: '/dashboard/profile', label: 'PROFILE', icon: User },
]

function isActive(pathname: string, label: string, href: string) {
  if (label === 'WORKOUT') {
    return (
      pathname.startsWith('/dashboard/workout') ||
      pathname.startsWith('/dashboard/lift-tracker') ||
      pathname.startsWith('/dashboard/analytics') ||
      pathname.startsWith('/dashboard/splits')
    )
  }
  if (label === 'HOME') {
    return pathname.startsWith('/dashboard/home')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardNav({
  userName = 'Alex Rivera',
  initials = 'AR',
}: DashboardNavProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-silver/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link
            href="/dashboard/home"
            className="flex min-h-11 items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <Dumbbell className="size-5 text-gold" aria-hidden="true" />
            <span className="font-heading text-metallic text-sm font-bold tracking-[0.2em] sm:text-base">
              IRONSTACK
            </span>
          </Link>

          <nav
            aria-label="Dashboard navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {navLinks.map((link) => {
              const active = isActive(pathname, link.label, link.href)
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold tracking-[0.12em] transition-all ${
                  active
                    ? 'bg-gold-tint text-gold'
                    : 'text-muted-foreground hover:bg-silver/10 hover:text-foreground'
                }`}
                >
                  <link.icon className="size-3.5" aria-hidden="true" />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="flex min-h-11 items-center gap-3 rounded-full px-1 transition-opacity hover:opacity-80"
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-foreground">{userName}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full border chip-amber text-xs font-bold">
                {initials}
              </div>
            </Link>

            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg border border-silver/15 text-foreground transition-colors hover:border-gold/40 hover:text-gold md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-nav-drawer"
            className="border-t border-silver/10 bg-background/95 px-4 py-3 md:hidden"
          >
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const active = isActive(pathname, link.label, link.href)
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold tracking-[0.12em] transition-colors ${
                      active
                        ? 'bg-gold-tint text-gold'
                        : 'text-muted-foreground hover:bg-silver/10 hover:text-foreground'
                    }`}
                  >
                    <link.icon className="size-4" aria-hidden="true" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Bottom tab bar — phone widths only */}
      <nav
        aria-label="Mobile tabs"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-silver/10 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {navLinks.map((link) => {
            const active = isActive(pathname, link.label, link.href)
            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-[0.14em] transition-colors ${
                  active ? 'text-gold' : 'text-muted-foreground'
                }`}
              >
                <link.icon
                  className={`size-5 ${active ? 'text-gold' : ''}`}
                  aria-hidden="true"
                />
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
