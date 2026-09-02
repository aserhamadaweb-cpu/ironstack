/** Client-side PWA / install detection helpers. */

export const PWA_INSTALLED_HINT_KEY = 'ironstack-pwa-installed'

export type PwaPlatform = 'ios' | 'macos-safari' | 'android' | 'desktop' | 'unknown'

type InstalledRelatedApp = { platform?: string; url?: string }

type NavigatorWithPwa = Navigator & {
  standalone?: boolean
  getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>
}

export function detectPwaPlatform(): PwaPlatform {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios'

  const isMac = /Macintosh|Mac OS X/.test(ua)
  const isSafari =
    /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua)
  if (isMac && isSafari) return 'macos-safari'

  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** True when the page is running inside an installed PWA (not a browser tab). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false

  const nav = window.navigator as NavigatorWithPwa
  if (nav.standalone === true) return true

  for (const mode of ['standalone', 'fullscreen', 'minimal-ui'] as const) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true
    } catch {
      /* ignore */
    }
  }

  return false
}

export function markPwaInstalledHint() {
  try {
    localStorage.setItem(PWA_INSTALLED_HINT_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function hasLocalPwaInstalledHint(): boolean {
  try {
    return localStorage.getItem(PWA_INSTALLED_HINT_KEY) === '1'
  } catch {
    return false
  }
}

/** Best-effort: is the IronStack PWA likely installed on this device? */
export async function detectLikelyInstalledPwa(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (isStandaloneDisplay()) return true
  if (hasLocalPwaInstalledHint()) return true

  const nav = window.navigator as NavigatorWithPwa
  if (typeof nav.getInstalledRelatedApps === 'function') {
    try {
      const related = await nav.getInstalledRelatedApps()
      if (
        related.some(
          (app) =>
            app.platform === 'webapp' &&
            (!app.url || app.url.startsWith(window.location.origin)),
        )
      ) {
        return true
      }
    } catch {
      /* unsupported or blocked */
    }
  }

  return false
}

/** Same-origin path + query + hash for “open in installed app”. */
export function currentAppDeepLink(): string {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function openCurrentUrlInAppContext() {
  window.location.assign(currentAppDeepLink())
}
