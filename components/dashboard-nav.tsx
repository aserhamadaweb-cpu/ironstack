'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BrainCircuit,
  ClipboardList,
  Compass,
  Dumbbell,
  History,
  Home,
  House,
  Layers,
  Medal,
  Menu,
  MessageSquare,
  Settings,
  Swords,
  TrendingUp,
  Trophy,
  User,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ChooseUsernameGate } from '@/components/choose-username-gate'
import { CoachSuggestionToast } from '@/components/coach-suggestion-toast'
import { GuestBanner } from '@/components/guest-banner'
import { useGuestGate } from '@/components/guest-gate-provider'
import { IronStackMark } from '@/components/ironstack-mark'
import { useGuardedNavigation } from '@/lib/use-guarded-navigation'
import { NotificationBell } from '@/components/notification-bell'
import { OfflineStatusBadges } from '@/components/offline-status-badges'
import { useIsGuest } from '@/components/use-is-guest'
import { useSuggestionBadge } from '@/components/use-suggestion-badge'
import { getHomeSnapshot } from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'
import { useEmbeddedSessionActive } from '@/lib/offline/embedded-session'
import {
  APP_TOUR_CLOSE_SIDEBAR_EVENT,
  APP_TOUR_END_EVENT,
  APP_TOUR_OPEN_SIDEBAR_EVENT,
} from '@/lib/app-tour'

const FloatingActions = dynamic(
  () =>
    import('@/components/floating-actions').then((m) => m.FloatingActions),
  { ssr: false },
)

const NAV_AVATAR_STORAGE = 'ironstack-nav-avatar'

function readStoredNavAvatar(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return usableAvatarUrl(sessionStorage.getItem(NAV_AVATAR_STORAGE))
  } catch {
    return null
  }
}

function writeStoredNavAvatar(url: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (url) sessionStorage.setItem(NAV_AVATAR_STORAGE, url)
    else sessionStorage.removeItem(NAV_AVATAR_STORAGE)
  } catch {
    /* ignore quota / private mode */
  }
}

type DashboardNavProps = {
  userName?: string
  initials?: string
  profileHref?: string
  avatarUrl?: string | null
  isGuest?: boolean
}

type TabId = 'home' | 'workout' | 'progress' | 'profile'

type NavId =
  | TabId
  | 'explore'
  | 'board'
  | 'splits'
  | 'exercises'
  | 'homeWorkouts'
  | 'history'
  | 'progress'
  | 'prs'
  | 'achievements'
  | 'coach'
  | 'messages'
  | 'challenges'
  | 'settings'

type NavLink = {
  href: string
  id: NavId
  icon: typeof Home
}

const TOUR_NAV_ATTR: Partial<Record<NavId, string>> = {
  home: 'nav-home',
  workout: 'nav-workout',
  exercises: 'nav-exercises',
  homeWorkouts: 'nav-home-workouts',
  history: 'nav-history',
  progress: 'nav-progress',
  coach: 'nav-coach',
  settings: 'nav-settings',
  messages: 'nav-messages',
  profile: 'nav-profile',
}

type TabLink = {
  href: string
  id: TabId
  icon: typeof Home
  labelKey: 'tabHome' | 'tabWorkout' | 'tabProgress' | 'tabProfile'
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
    href: '/dashboard/progress',
    id: 'progress',
    icon: TrendingUp,
    labelKey: 'tabProgress',
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
  { href: '/dashboard/home-workouts', id: 'homeWorkouts', icon: House },
  { href: '/dashboard/explore', id: 'explore', icon: Compass },
  { href: '/dashboard/messages', id: 'messages', icon: MessageSquare },
  { href: '/dashboard/leaderboard', id: 'board', icon: Trophy },
  { href: '/dashboard/splits', id: 'splits', icon: Layers },
  { href: '/dashboard/exercises', id: 'exercises', icon: Dumbbell },
  { href: '/dashboard/history', id: 'history', icon: History },
  { href: '/dashboard/progress', id: 'progress', icon: TrendingUp },
  { href: '/dashboard/records', id: 'prs', icon: Trophy },
  { href: '/dashboard/achievements', id: 'achievements', icon: Medal },
  { href: '/dashboard/challenges', id: 'challenges', icon: Swords },
  { href: '/dashboard/ai-coach', id: 'coach', icon: BrainCircuit },
  { href: '/dashboard/settings', id: 'settings', icon: Settings },
]

/** Only warm the primary tab destinations — never the full sidebar catalog. */
const TAB_PREFETCH_ROUTES = [
  '/dashboard/home',
  '/dashboard/workout',
  '/dashboard/progress',
  '/dashboard/profile',
  '/dashboard/splits',
]

function isTabActive(pathname: string, id: TabId, href: string) {
  if (id === 'workout') {
    return (
      pathname.startsWith('/dashboard/workout') ||
      pathname.startsWith('/dashboard/lift-tracker') ||
      pathname.startsWith('/dashboard/analytics') ||
      pathname.startsWith('/dashboard/splits') ||
      pathname.startsWith('/dashboard/exercises') ||
      pathname.startsWith('/dashboard/home-workouts') ||
      pathname.startsWith('/dashboard/history') ||
      pathname.startsWith('/dashboard/sessions')
    )
  }
  if (id === 'progress') {
    return pathname.startsWith('/dashboard/progress')
  }
  if (id === 'home') {
    return pathname === '/dashboard/home' || pathname.startsWith('/dashboard/home/')
  }
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
  if (id === 'exercises') return pathname.startsWith('/dashboard/exercises')
  if (id === 'homeWorkouts') return pathname.startsWith('/dashboard/home-workouts')
  if (id === 'home') {
    return pathname === '/dashboard/home' || pathname.startsWith('/dashboard/home/')
  }
  if (id === 'messages') return pathname.startsWith('/dashboard/messages')
  if (id === 'explore') return pathname.startsWith('/dashboard/explore')
  if (id === 'board') return pathname.startsWith('/dashboard/leaderboard')
  if (id === 'history') return pathname.startsWith('/dashboard/history')
  if (id === 'progress') return pathname.startsWith('/dashboard/progress')
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
  profileHref: _profileHref,
  avatarUrl,
  isGuest: isGuestProp,
}: DashboardNavProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()
  const { isGuest: isGuestClient } = useIsGuest()
  const { count: rawSuggestionCount } = useSuggestionBadge()
  const { online, hydrated } = useOfflineStatus()
  const floorMode = hydrated && !online
  const embeddedSession = useEmbeddedSessionActive()
  const isGuest = Boolean(isGuestProp) || isGuestClient
  const { openUpgrade } = useGuestGate()
  const { onNavClick } = useGuardedNavigation()
  const hideTabBar = shouldHideTabBar(pathname) || embeddedSession
  const [menuOpen, setMenuOpen] = useState(false)
  const [cachedPhoto, setCachedPhoto] = useState<string | null>(readStoredNavAvatar)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const openGuestLock = useCallback(
    () => openUpgrade('messages'),
    [openUpgrade],
  )

  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  useEffect(() => {
    const openForTour = () => setMenuOpen(true)
    const closeForTour = () => setMenuOpen(false)
    window.addEventListener(APP_TOUR_OPEN_SIDEBAR_EVENT, openForTour)
    window.addEventListener(APP_TOUR_CLOSE_SIDEBAR_EVENT, closeForTour)
    window.addEventListener(APP_TOUR_END_EVENT, closeForTour)
    return () => {
      window.removeEventListener(APP_TOUR_OPEN_SIDEBAR_EVENT, openForTour)
      window.removeEventListener(APP_TOUR_CLOSE_SIDEBAR_EVENT, closeForTour)
      window.removeEventListener(APP_TOUR_END_EVENT, closeForTour)
    }
  }, [])

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
    if (isGuest) {
      document.body.classList.add('has-guest-banner')
    } else {
      document.body.classList.remove('has-guest-banner')
    }
    return () => {
      document.body.classList.remove('has-guest-banner')
    }
  }, [isGuest])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('nav-menu-scroll-lock')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('nav-menu-scroll-lock')
      document.body.style.removeProperty('overflow')
    }
  }, [menuOpen, closeMenu])

  // Warm only primary tabs on idle — blasting 15+ RSC routes starved bad networks
  // and made the app look like it was loading pages the user never opened.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      for (const href of TAB_PREFETCH_ROUTES) {
        router.prefetch(href)
      }
    }
    const ric = window.requestIdleCallback?.(run, { timeout: 4_000 })
    const t = ric == null ? window.setTimeout(run, 1_200) : null
    return () => {
      cancelled = true
      if (ric != null) window.cancelIdleCallback?.(ric)
      if (t != null) window.clearTimeout(t)
    }
  }, [router])

  const profileLinkHref = '/dashboard/profile'

  useEffect(() => {
    if (avatarUrl !== undefined) {
      const next = usableAvatarUrl(avatarUrl)
      writeStoredNavAvatar(next)
      setCachedPhoto(next)
      return
    }
    const stored = readStoredNavAvatar()
    if (stored) setCachedPhoto(stored)
    void getHomeSnapshot().then((snap) => {
      const next = usableAvatarUrl(snap?.avatarUrl)
      if (!next) return
      writeStoredNavAvatar(next)
      setCachedPhoto(next)
    })
  }, [avatarUrl])

  const photo =
    avatarUrl !== undefined ? usableAvatarUrl(avatarUrl) : cachedPhoto
  const onProfile =
    pathname.startsWith('/profile/') ||
    pathname.startsWith('/dashboard/profile')

  const visibleTabs = floorMode
    ? tabs.filter((tab) => tab.id === 'home')
    : tabs

  const visibleSidebarLinks = sidebarLinks.filter((link) => {
    if (floorMode) {
      return link.id === 'home'
    }
    return true
  })

  const allSidebarLinks: NavLink[] = floorMode
    ? visibleSidebarLinks
    : [
        ...visibleSidebarLinks,
        { href: profileLinkHref, id: 'profile', icon: User },
      ]

  const labelFor = (id: NavId) => t(id)
  const suggestionCount = isGuest ? 0 : rawSuggestionCount

  return (
    <>
      <ChooseUsernameGate />

      <header className="nav-shell sticky top-0 z-50">
        {isGuest ? <GuestBanner /> : null}
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-1 px-2 sm:h-14 sm:gap-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              data-tour="nav-menu"
              data-tour-spotlight="icon"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-silver/15 text-foreground transition-colors active:border-gold/40 active:text-gold"
              aria-expanded={menuOpen}
              aria-controls="site-nav-sidebar"
              aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <span
                  data-tour="nav-menu-icon"
                  data-tour-spotlight="icon"
                  className="inline-flex items-center justify-center"
                >
                  <Menu className="size-5" aria-hidden="true" />
                </span>
              )}
            </button>

            <Link
              href="/dashboard/home"
              prefetch={false}
              className="flex min-h-11 min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-1 transition-opacity active:opacity-70"
            >
              <IronStackMark size="sm" className="shrink-0" />
              <span className="font-heading text-metallic hidden min-w-0 truncate text-sm font-bold tracking-[0.18em] min-[480px]:inline">
                IRONSTACK
              </span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <OfflineStatusBadges />
            {!isGuest && !floorMode ? <NotificationBell /> : null}

            {!floorMode ? (
              <Link
                href="/dashboard/settings"
                prefetch={false}
                aria-label={t('settings')}
                className={`inline-flex size-11 items-center justify-center rounded-lg border transition-colors active:opacity-80 ${
                  isSidebarActive(pathname, 'settings', '/dashboard/settings')
                    ? 'border-gold/40 bg-gold-tint text-gold'
                    : 'border-border text-muted-foreground active:border-gold/40 active:text-gold'
                }`}
              >
                <Settings className="size-4" aria-hidden="true" />
              </Link>
            ) : null}

            {!floorMode ? (
              onProfile ? (
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
                  prefetch={false}
                  aria-label={t('profile')}
                  className="inline-flex size-11 items-center justify-center rounded-full transition-opacity active:opacity-80"
                >
                  <NavFace photo={photo} initials={initials} />
                </Link>
              )
            ) : null}
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
        data-tour="nav-sidebar"
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
              const tourAttr = TOUR_NAV_ATTR[link.id]
              return (
                <li key={`${link.id}-${link.href}`}>
                  {active ? (
                    <span
                      aria-current="page"
                      data-tour={tourAttr}
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-gold/25 bg-gold-tint px-4 text-sm font-semibold tracking-[0.12em] text-gold"
                    >
                      <link.icon className="size-4" aria-hidden="true" />
                      {label}
                    </span>
                  ) : isGuest &&
                    (link.id === 'messages' || link.id === 'coach') ? (
                    <button
                      type="button"
                      data-tour={tourAttr}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-start text-sm font-semibold tracking-[0.12em] text-muted-foreground transition-colors active:bg-silver/10 active:text-foreground"
                      onClick={() => {
                        closeMenu()
                        openUpgrade(
                          link.id === 'coach' ? 'aiCoach' : 'messages',
                        )
                      }}
                    >
                      <link.icon className="size-4" aria-hidden="true" />
                      {label}
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      prefetch={false}
                      data-tour={tourAttr}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold tracking-[0.12em] text-muted-foreground transition-colors active:bg-silver/10 active:text-foreground lg:hover:bg-silver/10 lg:hover:text-foreground"
                      onClick={(e) => {
                        onNavClick(link.href, e)
                        closeMenu()
                      }}
                    >
                      <link.icon className="size-4" aria-hidden="true" />
                      {label}
                      {link.id === 'coach' && suggestionCount > 0 ? (
                        <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold tabular-nums text-background">
                          {suggestionCount > 9 ? '9+' : suggestionCount}
                        </span>
                      ) : null}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {!hideTabBar && (
        <nav className="app-tabbar" aria-label={t('primary')} data-tour="nav-tabbar">
          <div className="mx-auto flex max-w-lg lg:max-w-none">
            {visibleTabs.map((tab) => {
              const active = isTabActive(pathname, tab.id, tab.href)
              const label = t(tab.labelKey)
              const Icon = tab.icon
              const className = 'app-tabbar-item'
              const tourAttr = TOUR_NAV_ATTR[tab.id]
              const href = tab.id === 'profile' ? profileLinkHref : tab.href

              if (active) {
                return (
                  <span
                    key={tab.id}
                    aria-current="page"
                    data-tour={tourAttr}
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
                  href={href}
                  data-tour={tourAttr}
                  className={className}
                  prefetch
                  onClick={(e) => {
                    onNavClick(href, e)
                  }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      {!floorMode && !embeddedSession ? (
        <FloatingActions onGuestMessages={openGuestLock} />
      ) : null}
      {!floorMode && !embeddedSession && !isGuest ? (
        <CoachSuggestionToast />
      ) : null}
    </>
  )
}
