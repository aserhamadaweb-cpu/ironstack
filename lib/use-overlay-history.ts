'use client'

import { useCallback, useEffect, useRef } from 'react'

const STATE_KEY = 'ironstackOverlay'

type OverlayLayer = 'library' | 'details'

/**
 * Pushes history entries for stacked overlays so browser/mobile Back closes
 * the top layer instead of leaving the page. Closing via UI pops those entries
 * so leftover back-stack items cannot reopen a dead overlay.
 */
export function useOverlayHistory(options: {
  libraryOpen: boolean
  detailsOpen: boolean
  onCloseDetails: () => void
  onCloseLibrary: () => void
}) {
  const { libraryOpen, detailsOpen, onCloseDetails, onCloseLibrary } = options
  const depthRef = useRef(0)
  const ignorePopsRef = useRef(0)
  const detailsOpenRef = useRef(detailsOpen)
  const libraryOpenRef = useRef(libraryOpen)
  detailsOpenRef.current = detailsOpen
  libraryOpenRef.current = libraryOpen

  const closeDetailsRef = useRef(onCloseDetails)
  const closeLibraryRef = useRef(onCloseLibrary)
  closeDetailsRef.current = onCloseDetails
  closeLibraryRef.current = onCloseLibrary

  useEffect(() => {
    if (!libraryOpen) return
    if (depthRef.current >= 1) return
    history.pushState({ ...history.state, [STATE_KEY]: 'library' as OverlayLayer }, '')
    depthRef.current = 1
  }, [libraryOpen])

  useEffect(() => {
    if (!detailsOpen) return
    if (depthRef.current >= 2) return
    history.pushState({ ...history.state, [STATE_KEY]: 'details' as OverlayLayer }, '')
    depthRef.current = 2
  }, [detailsOpen])

  useEffect(() => {
    const onPop = () => {
      if (ignorePopsRef.current > 0) {
        ignorePopsRef.current -= 1
        return
      }
      if (depthRef.current >= 2) {
        depthRef.current = 1
        closeDetailsRef.current()
        return
      }
      if (depthRef.current >= 1) {
        depthRef.current = 0
        closeLibraryRef.current()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    return () => {
      const depth = depthRef.current
      if (depth > 0) {
        ignorePopsRef.current = depth
        depthRef.current = 0
        history.go(-depth)
      }
    }
  }, [])

  const requestCloseDetails = useCallback(() => {
    if (depthRef.current >= 2) {
      history.back()
      return
    }
    closeDetailsRef.current()
  }, [])

  const requestCloseLibrary = useCallback(() => {
    const depth = depthRef.current
    if (depth > 0) {
      ignorePopsRef.current = depth
      depthRef.current = 0
      history.go(-depth)
    }
    closeLibraryRef.current()
  }, [])

  return { requestCloseDetails, requestCloseLibrary }
}

/**
 * Pushes a single history entry while a page-level details overlay is open so
 * browser/mobile Back closes details instead of leaving the page.
 */
export function useDetailsLayerHistory(options: {
  open: boolean
  onClose: () => void
}) {
  const { open, onClose } = options
  const depthRef = useRef(0)
  const ignorePopsRef = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      depthRef.current = 0
      return
    }
    if (depthRef.current >= 1) return
    const frame = window.requestAnimationFrame(() => {
      if (depthRef.current >= 1 || !open) return
      history.pushState({ ...history.state, [STATE_KEY]: 'details' as OverlayLayer }, '')
      depthRef.current = 1
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    const onPop = () => {
      if (ignorePopsRef.current > 0) {
        ignorePopsRef.current -= 1
        return
      }
      if (depthRef.current >= 1) {
        depthRef.current = 0
        onCloseRef.current()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const requestClose = useCallback(() => {
    if (depthRef.current >= 1) {
      history.back()
      return
    }
    onCloseRef.current()
  }, [])

  return requestClose
}
