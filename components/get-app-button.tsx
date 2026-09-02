'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import {
  isStandaloneDisplay,
  markPwaInstalledHint,
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
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true)
      markPwaInstalledHint()
    }

    const onBip = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      setShowHelp(false)
      markPwaInstalledHint()
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
              ? 'is-panel absolute end-0 top-[calc(100%+0.5rem)] z-50 w-[min(23rem,calc(100vw-1.5rem))] p-4 text-start shadow-[var(--panel-shadow)]'
              : 'is-panel w-full p-4 text-start'
          }
        >
          <InstallTutorial />
        </div>
      )}
    </div>
  )
}
