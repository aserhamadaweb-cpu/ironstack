'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  detectPwaPlatform,
  isStandaloneDisplay,
  markPwaInstalledHint,
  type PwaPlatform,
} from '@/lib/pwa-client'
import { InstallTutorial } from '@/components/install-tutorial'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
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
  const t = useTranslations('installTutorial')
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)
  const pendingAndroidInstall = useRef(false)
  const promptingRef = useRef(false)

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [platform, setPlatform] = useState<PwaPlatform>('unknown')
  const [portalReady, setPortalReady] = useState(false)

  const isIos = platform === 'ios'
  const isAndroid = platform === 'android'

  const runInstallPrompt = async (event: BeforeInstallPromptEvent) => {
    if (promptingRef.current) return
    promptingRef.current = true
    pendingAndroidInstall.current = false
    try {
      // Each BeforeInstallPromptEvent can only be prompted once.
      deferredRef.current = null
      setDeferred(null)
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
        markPwaInstalledHint()
      }
    } catch {
      /* Prompt unavailable — keep listening for the next install event. */
    } finally {
      promptingRef.current = false
    }
  }

  useEffect(() => {
    setPortalReady(true)
    setPlatform(detectPwaPlatform())

    if (isStandaloneDisplay()) {
      setInstalled(true)
      markPwaInstalledHint()
    }

    const onBip = (raw: Event) => {
      raw.preventDefault()
      const event = raw as BeforeInstallPromptEvent
      deferredRef.current = event
      setDeferred(event)
      // Android: if they already tapped GET APP, install immediately.
      if (pendingAndroidInstall.current) {
        void runInstallPrompt(event)
      }
    }
    const onInstalled = () => {
      setInstalled(true)
      deferredRef.current = null
      setDeferred(null)
      setShowHelp(false)
      pendingAndroidInstall.current = false
      markPwaInstalledHint()
    }

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!showHelp || !isIos) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowHelp(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [showHelp, isIos])

  if (installed) return null

  const onClick = async () => {
    // Android: always try the native install sheet — never show a tutorial.
    if (isAndroid) {
      const event = deferredRef.current
      if (event) {
        await runInstallPrompt(event)
        return
      }
      // Chrome may not have fired beforeinstallprompt yet — remember the tap
      // and prompt the moment the event arrives (still no tutorial).
      pendingAndroidInstall.current = true
      return
    }

    // Desktop Chromium: one-tap install when the browser offers it.
    if (deferred && !isIos) {
      await runInstallPrompt(deferred)
      return
    }

    // iPhone (and other browsers without a native prompt): show the guide.
    setShowHelp((open) => !open)
  }

  const closeHelp = () => setShowHelp(false)

  const iosGuide =
    showHelp && isIos && portalReady
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-guide-title"
            onClick={closeHelp}
          >
            <div
              className="flex max-h-[min(94svh,52rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gold/30 bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-silver/10 px-4 pb-3 pt-4 sm:px-5">
                <p
                  id="ios-install-guide-title"
                  className="font-heading text-lg font-bold text-headline"
                >
                  {t('iosGuideTitle')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('iosGuideBody')}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                <InstallTutorial
                  platform="ios"
                  prominent
                  onClose={closeHelp}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div
      className={
        compact
          ? 'relative flex shrink-0 flex-col items-end'
          : 'flex w-full max-w-md flex-col items-center gap-3'
      }
    >
      <button type="button" onClick={() => void onClick()} className={className}>
        <Download className="size-4" aria-hidden="true" />
        {label}
      </button>

      {/* Help panel only for non-Android, non-iOS browsers without a native prompt. */}
      {showHelp && !isIos && !isAndroid ? (
        <div
          role="status"
          className={
            compact
              ? 'is-panel absolute end-0 top-[calc(100%+0.5rem)] z-50 w-[min(23rem,calc(100vw-1.5rem))] p-4 text-start shadow-[var(--panel-shadow)]'
              : 'is-panel w-full p-4 text-start'
          }
        >
          <InstallTutorial onClose={closeHelp} />
        </div>
      ) : null}

      {iosGuide}
    </div>
  )
}
