'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CTA_PRIMARY } from '@/lib/accent'
import {
  androidAppIntentUrl,
  detectLikelyInstalledPwa,
  detectPwaPlatform,
  isInAppBrowser,
  isStandaloneDisplay,
} from '@/lib/pwa-client'

const HANDOFF_KEY = 'ironstack-share-app-handoff'

/**
 * Shared https links opened from WhatsApp stay inside that app's browser.
 * On Android, hand the same URL to the system so the installed IronStack app can claim it.
 */
export function ShareLinkAppHandoff() {
  const t = useTranslations('splitShare')
  const [intentHref, setIntentHref] = useState<string | null>(null)
  const [showIosNote, setShowIosNote] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay()) return

    const platform = detectPwaPlatform()
    const inApp = isInAppBrowser(
      window.navigator.userAgent,
      document.referrer,
    )
    const pageUrl = window.location.href

    if (platform === 'android') {
      const intent = androidAppIntentUrl(pageUrl)
      const reveal = () => setIntentHref(intent)

      if (inApp) {
        reveal()
        try {
          if (sessionStorage.getItem(HANDOFF_KEY) !== '1') {
            sessionStorage.setItem(HANDOFF_KEY, '1')
            window.location.replace(intent)
          }
        } catch {
          /* Private mode can block sessionStorage. The button still works. */
        }
        return
      }

      void detectLikelyInstalledPwa().then((installed) => {
        if (installed && !isStandaloneDisplay()) reveal()
      })
      return
    }

    if (platform === 'ios' && inApp) setShowIosNote(true)
  }, [])

  if (!intentHref && !showIosNote) return null

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      {intentHref ? (
        <>
          <p className="text-sm text-muted-foreground">{t('openInAppHint')}</p>
          <a
            href={intentHref}
            className={`mt-3 inline-flex min-h-12 w-full items-center justify-center px-5 ${CTA_PRIMARY}`}
          >
            {t('openInApp')}
          </a>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('openInAppIos')}
        </p>
      )}
    </div>
  )
}
