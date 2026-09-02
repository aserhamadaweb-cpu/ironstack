'use client'

import { useCallback } from 'react'

/**
 * Overlay close helpers.
 *
 * We intentionally avoid history.pushState / back / go here. Those entries
 * conflict with Next.js App Router history and left orphan stack items that
 * could revert the user's route after tab or page navigation (especially on
 * slow networks). Overlays close via UI, Escape, or unmount on route change.
 */
export function useOverlayHistory(options: {
  onCloseDetails: () => void
  onCloseLibrary: () => void
}) {
  const { onCloseDetails, onCloseLibrary } = options

  const requestCloseDetails = useCallback(() => {
    onCloseDetails()
  }, [onCloseDetails])

  const requestCloseLibrary = useCallback(() => {
    onCloseDetails()
    onCloseLibrary()
  }, [onCloseDetails, onCloseLibrary])

  return { requestCloseDetails, requestCloseLibrary }
}

/** Closes a page-level details overlay without touching browser history. */
export function useDetailsLayerHistory(options: { onClose: () => void }) {
  const { onClose } = options
  return useCallback(() => {
    onClose()
  }, [onClose])
}
