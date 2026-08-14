'use client'

import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function detectPlatform(): 'ios' | 'macos-safari' | 'android' | 'desktop' | 'unknown' {
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

type GetAppButtonProps = {
  className?: string
  label?: string
  /** Tighter wrapper for header placement */
  compact?: boolean
}

export function GetAppButton({
  className = 'btn-pill btn-pill-primary px-10 py-4 text-sm tracking-[0.25em]',
  label = 'GET APP',
  compact = false,
}: GetAppButtonProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [platform, setPlatform] = useState<ReturnType<typeof detectPlatform>>(
    'unknown',
  )

  useEffect(() => {
    setPlatform(detectPlatform())

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
      )
    if (standalone) setInstalled(true)

    const onBip = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      setShowHelp(false)
    }

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setDeferred(null)
        setInstalled(true)
      }
      return
    }
    setShowHelp((open) => !open)
  }

  return (
    <div
      className={
        compact
          ? 'relative flex shrink-0 flex-col items-end'
          : 'flex w-full max-w-md flex-col items-center gap-3'
      }
    >
      <button type="button" onClick={onClick} className={className}>
        <Download className="size-4" aria-hidden="true" />
        {label}
      </button>

      {showHelp && (
        <div
          role="status"
          className={
            compact
              ? 'is-panel absolute end-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-1.5rem))] space-y-2 p-4 text-start text-sm leading-relaxed text-muted-foreground shadow-[var(--panel-shadow)]'
              : 'is-panel w-full space-y-2 p-4 text-start text-sm leading-relaxed text-muted-foreground'
          }
        >
          {platform === 'ios' && (
            <p>
              On iPhone/iPad Safari: tap{' '}
              <Share className="mx-0.5 inline size-3.5 text-gold" aria-hidden="true" />{' '}
              <span className="font-semibold text-foreground">Share</span>, then{' '}
              <span className="font-semibold text-foreground">
                Add to Home Screen
              </span>
              .
            </p>
          )}
          {platform === 'macos-safari' && (
            <p>
              On Mac Safari: choose{' '}
              <span className="font-semibold text-foreground">File → Add to Dock</span>{' '}
              to install IronStack like an app.
            </p>
          )}
          {(platform === 'android' ||
            platform === 'desktop' ||
            platform === 'unknown') && (
            <p>
              Use your browser&apos;s install menu (often the address bar install
              icon, or{' '}
              <span className="font-semibold text-foreground">
                Menu → Install app
              </span>
              ). Chrome and Edge support one-tap install when available.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
