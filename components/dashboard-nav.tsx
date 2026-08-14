'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BrainCircuit,
  ClipboardList,
  Compass,
  History,
  Home,
  Layers,
  Medal,
  Menu,
  MessageSquare,
  Settings,
  Swords,
  Trophy,
  User,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReducedMotion } from 'framer-motion'
import { ChooseUsernameGate } from '@/components/choose-username-gate'
import { FloatingActions } from '@/components/floating-actions'
import { GuestBanner } from '@/components/guest-banner'
import { IronStackMark } from '@/components/ironstack-mark'
import { triggerIronStackNavTransition } from '@/components/nav-transition-overlay'
import { NotificationBell } from '@/components/notification-bell'
import { useIsGuest } from '@/components/use-is-guest'

type DashboardNavProps = {
  userName?: string
  initials?: string
  profileHref?: string
  avatarUrl?: string | null
}

type TabId = 'home' | 'workout' | 'messages' | 'challenges' | 'profile'

type NavId =
  | TabId
  | 'explore'
  | 'board'
  | 'splits'
  | 'history'
  | 'prs'
  | 'achievements'
  | 'coach'
  | 'settings'

type NavLink = {
  href: string
  id: NavId
  icon: typeof Home
}

type TabLink = {
  href: string
  id: TabId
  icon: typeof Home
  labelKey: 'tabHome' | 'tabWorkout' | 'tabMessages' | 'tabChallenges' | 'tabProfile'
  guestHidden?: boolean
}

const tabs: TabLink[] = [
  { href: '/dashboard/home', id: 'home', icon: Home, labelKey: 'tabHome' },
  {
    href: '/dashboard/workout',
    id: 'workout',
    icon: ClipboardList,
    labelKey: 'tabWorkout',
  },
  {
    href: '/dashboard/messages',
    id: 'messages',
    icon: MessageSquare,
    labelKey: 'tabMessages',
    guestHidden: true,
  },
  {
    href: '/dashboard/challenges',
    id: 'challenges',
    icon: Swords,
    labelKey: 'tabChallenges',
    guestHidden: true,
  },
  {
    href: '/dashboard/profile',
    id: 'profile',
    icon: User,
    labelKey: 'tabProfile',
  },
]

const sidebarLinks: NavLink[] = [
  { href: '/dashboard/home', id: 'home', icon: Home },
  { href: '/dashboard/workout', id: 'workout', icon: ClipboardList },
  { href: '/dashboard/explore', id: 'explore', icon: Compass },
  { href: '/dashboard/messages', id: 'messages', icon: MessageSquare },
  { href: '/dashboard/leaderboard', id: 'board', icon: Trophy },
  { href: '/dashboard/splits', id: 'splits', icon: Layers },
  { href: '/dashboard/history', id: 'history', icon: History },
  { href: '/dashboard/records', id: 'prs', icon: Trophy },
  { href: '/dashboard/achievements', id: 'achievements', icon: Medal },
  { href: '/dashboard/challenges', id: 'challenges', icon: Swords },
  { href: '/dashboard/ai-coach', id: 'coach', icon: BrainCircuit },
  { href: '/dashboard/settings', id: 'settings', icon: Settings },
]

const PREFETCH_ROUTES = [
  '/dashboard/home',
  '/dashboard/workout',
  '/dashboard/messages',
  '/dashboard/challenges',
  '/dashboard/profile',
  '/dashboard/settings',
  '/dashboard/ai-coach',
  '/dashboard/explore',
  '/dashboard/splits',
  '/dashboard/history',
]

function isTabActive(pathname: string, id: TabId, href: string) {
  if (id === 'workout') {
    return (
      pathname.startsWith('/dashboard/workout') ||
      pathname.startsWith('/dashboard/lift-tracker') ||
      pathname.startsWith('/dashboard/analytics') ||
      pathname.startsWith('/dashboard/splits') ||
      pathname.startsWith('/dashboard/history') ||
      pathname.startsWith('/dashboard/sessions')
    )
  }
  if (id === 'home') return pathname.startsWith('/dashboard/home')
  if (id === 'messages') return pathname.startsWith('/dashboard/messages')
  if (id === 'challenges') return pathname.startsWith('/dashboard/challenges')
  if (id === 'profile') {
    return (
      pathname.startsWith('/dashboard/profile') ||
      pathname.startsWith('/dashboard/settings') ||
      pathname.startsWith('/dashboard/records') ||
      pathname.startsWith('/dashboard/achievements') ||
      pathname.startsWith('/dashboard/explore') ||
      pathname.startsWith('/dashboard/leaderboard') ||
      pathname.startsWith('/dashboard/ai-coach') ||
      pathname.startsWith('/dashboard/notifications') ||
      pathname.startsWith('/profile/')
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isSidebarActive(pathname: string, id: NavId, href: string) {
  if (id === 'workout') {
    return (
      pathname.startsWith('/dashboard/workout') ||
      pathname.startsWith('/dashboard/lift-tracker') ||
      pathname.startsWith('/dashboard/analytics')
    )
  }
  if (id === 'splits') {
    return (
      pathname === '/dashboard/splits' ||
      pathname.startsWith('/dashboard/splits/')
    )
  }
  if (id === 'home') return pathname.startsWith('/dashboard/home')
  if (id === 'messages') return pathname.startsWith('/dashboard/messages')
  if (id === 'explore') return pathname.startsWith('/dashboard/explore')
  if (id === 'board') return pathname.startsWith('/dashboard/leaderboard')
  if (id === 'history') return pathname.startsWith('/dashboard/history')
  if (id === 'prs') return pathname.startsWith('/dashboard/records')
  if (id === 'achievements') return pathname.startsWith('/dashboard/achievements')
  if (id === 'challenges') return pathname.startsWith('/dashboard/challenges')
  if (id === 'coach') return pathname.startsWith('/dashboard/ai-coach')
  if (id === 'settings') return pathname.startsWith('/dashboard/settings')
  if (id === 'profile') {
    return (
      pathname.startsWith('/dashboard/profile') ||
      pathname.startsWith('/profile/')
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Hide the tab bar during an in-progress workout so logging stays full-screen. */
function shouldHideTabBar(pathname: string) {
  return /\/splits\/[^/]+\/session(?:\/|$)/.test(pathname)
}

function usableAvatarUrl(url: string | null | undefined): string | null {
  const raw = url?.trim()
  if (!raw) return null
  if (
    raw.startsWith('https://') ||
    raw.startsWith('http://') ||
    raw.startsWith('/')
  ) {
    if (/^\/?0\.(jpg|jpeg|png|webp|gif)$/i.test(raw)) return null
    return raw
  }
  return null
}

function NavFace({
  photo,
  initials,
}: {
  photo: string | null
  initials: string
}) {
  return (
    <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-full border border-silver/20 bg-card text-xs font-bold text-gold">
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          className="object-cover"
          sizes="36px"
        />
      ) : (
        initials
      )}
    </span>
  )
}

export function DashboardNav({
  userName = 'Athlete',
  initials = 'A',
  profileHref,
  avatarUrl,
}: DashboardNavProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const { isGuest } = useIsGuest()
  const hideTabBar = shouldHideTabBar(pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /** Arm once — overlay plays a single slam after the destination paints. */
  const onPrimaryTabClick = useCallback(() => {
    if (!reduceMotion) triggerIronStackNavTransition()
  }, [reduceMotion])

  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  useEffect(() => {
    if (hideTabBar) {
      document.body.classList.remove('has-app-tabbar')
    } else {
      document.body.classList.add('has-app-tabbar')
    }
    return () => {
      document.body.classList.remove('has-app-tabbar')
    }
  }, [hideTabBar])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen, closeMenu])

  // Warm the core destinations so tab/sidebar taps feel instant.
  useEffect(() => {
    for (const href of PREFETCH_ROUTES) {
      router.prefetch(href)
    }
  }, [router])

  const profileLinkHref = profileHref?.trim() || '/dashboard/profile'
  const photo = usableAvatarUrl(avatarUrl)
  const onProfile =
    pathname.startsWith('/profile/') ||
    pathname.startsWith('/dashboard/profile')

  const visibleTabs = tabs
    .filter((tab) => !(isGuest && tab.guestHidden))
    .map((tab) =>
      tab.id === 'profile' ? { ...tab, href: profileLinkHref } : tab,
    )

  const visibleSidebarLinks = sidebarLinks.filter(
    (link) =>
      !(
        isGuest &&
        (link.id === 'messages' ||
          link.id === 'coach' ||
          link.id === 'challenges')
      ),
  )

  const allSidebarLinks: NavLink[] = [
    ...visibleSidebarLinks,
    { href: profileLinkHref, id: 'profile', icon: User },
  ]

  const labelFor = (id: NavId) => t(id)

  return (
    <>
      <ChooseUsernameGate />

      <header className="nav-shell sticky top-0 z-50">
        {isGuest ? <GuestBanner /> : null}
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-2 px-3 sm:h-14 sm:px-4">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-silver/15 text-foreground transition-colors active:border-gold/40 active:text-gold"
              aria-expanded={menuOpen}
              aria-controls="site-nav-sidebar"
              aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </button>

            <Link
              href="/dashboard/home"
              className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-lg px-1 transition-opacity active:opacity-70"
            >
              <IronStackMark size="sm" className="shrink-0" />
              <span className="font-heading text-metallic text-sm font-bold tracking-[0.2em]">
                IRONSTACK
              </span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />

            <Link
              href="/dashboard/settings"
              aria-label={t('settings')}
              className={`inline-flex size-11 items-center justify-center rounded-lg border transition-colors active:opacity-80 ${
                isSidebarActive(pathname, 'settings', '/dashboard/settings')
                  ? 'border-gold/40 bg-gold-tint text-gold'
                  : 'border-border text-muted-foreground active:border-gold/40 active:text-gold'
              }`}
            >
              <Settings className="size-4" aria-hidden="true" />
            </Link>

            {onProfile ? (
              <div
                className="inline-flex size-11 items-center justify-center"
                aria-current="page"
              >
                <NavFace photo={photo} initials={initials} />
                <span className="sr-only">{userName}</span>
              </div>
            ) : (
              <Link
                href={profileLinkHref}
                aria-label={t('profile')}
                className="inline-flex size-11 items-center justify-center rounded-full transition-opacity active:opacity-80"
              >
                <NavFace photo={photo} initials={initials} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[55] ${
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          tabIndex={menuOpen ? 0 : -1}
          aria-label={t('closeMenu')}
          onClick={closeMenu}
          className={`absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm transition-opacity duration-200 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      <aside
        id="site-nav-sidebar"
        role="navigation"
        aria-label={t('siteNav')}
        aria-hidden={!menuOpen}
        inert={!menuOpen ? true : undefined}
        className={`app-sidebar${menuOpen ? ' is-open' : ''}`}
      >
        <div className="flex h-12 items-center justify-between border-b border-silver/10 px-4 sm:h-14">
          <div className="flex items-center gap-2">
            <IronStackMark size="sm" className="shrink-0" />
            <span className="font-heading text-sm font-bold tracking-[0.18em] text-headline">
              {t('menu')}
            </span>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            aria-label={t('closeMenu')}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-silver/15 text-muted-foreground transition-colors active:border-gold/40 active:text-gold"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label={t('allSections')}
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          <ul className="flex flex-col gap-1">
            {allSidebarLinks.map((link) => {
              const active = isSidebarActive(pathname, link.id, link.href)
              const label = labelFor(link.id)
              return (
                <li key={`${link.id}-${link.href}`}>
                  {active ? (
                    <span
                      aria-current="page"
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-gold/25 bg-gold-tint px-4 text-sm font-semibold tracking-[0.12em] text-gold"
                    >
                      <link.icon className="size-4" aria-hidden="true" />
                      {label}
                    </span>
                  ) : (
                    <Link
                      href={link.href}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold tracking-[0.12em] text-muted-foreground transition-colors active:bg-silver/10 active:text-foreground lg:hover:bg-silver/10 lg:hover:text-foreground"
                      onClick={closeMenu}
                    >
                      <link.icon className="size-4" aria-hidden="true" />
                      {label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {!hideTabBar && (
        <nav className="app-tabbar" aria-label={t('primary')}>
          <div className="mx-auto flex max-w-lg lg:max-w-none">
            {visibleTabs.map((tab) => {
              const active = isTabActive(pathname, tab.id, tab.href)
              const label = t(tab.labelKey)
              const Icon = tab.icon
              const className = 'app-tabbar-item'

              if (active) {
                return (
                  <span
                    key={tab.id}
                    aria-current="page"
                    className={className}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </span>
                )
              }

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={className}
                  prefetch
                  onClick={onPrimaryTabClick}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      <FloatingActions />
    </>
  )
}
