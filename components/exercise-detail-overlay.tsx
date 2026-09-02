'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ExerciseDetailView } from '@/components/exercise-detail-view'
import { loadExerciseDetail } from '@/lib/exercises/fetch-detail-client'
import type { ExerciseDetailDto } from '@/lib/exercises/actions'
import { useDetailsLayerHistory } from '@/lib/use-overlay-history'

type ExerciseDetailOverlayProps = {
  exerciseId: string | null
  exerciseName?: string
  onClose: () => void
  backLabel: string
}

export function ExerciseDetailOverlay({
  exerciseId,
  exerciseName,
  onClose,
  backLabel,
}: ExerciseDetailOverlayProps) {
  const tCatalog = useTranslations('exerciseCatalog')
  const [mounted, setMounted] = useState(false)
  const [detail, setDetail] = useState<ExerciseDetailDto | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    setMounted(true)
  }, [])

  const close = useCallback(() => {
    onClose()
    setDetail(null)
    setStatus('idle')
  }, [onClose])

  const requestClose = useDetailsLayerHistory({
    open: Boolean(exerciseId),
    onClose: close,
  })

  useEffect(() => {
    if (!exerciseId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [exerciseId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !exerciseId) return
      event.preventDefault()
      requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exerciseId, requestClose])

  useEffect(() => {
    if (!exerciseId) {
      setDetail(null)
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    setDetail(null)
    void loadExerciseDetail(exerciseId, exerciseName)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setStatus('error')
          return
        }
        setDetail(data)
        setStatus('idle')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId, exerciseName])

  if (!exerciseId || !mounted) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-label={tCatalog('viewDetails')}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        {status === 'loading' ? (
          <p className="m-auto text-sm text-muted-foreground">
            {tCatalog('loading')}
          </p>
        ) : status === 'error' || !detail ? (
          <div className="m-auto max-w-sm text-center">
            <p className="text-sm font-semibold text-foreground">
              {tCatalog('loadError')}
            </p>
            <button
              type="button"
              onClick={requestClose}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-silver/20 px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {backLabel}
            </button>
          </div>
        ) : (
          <ExerciseDetailView
            exercise={detail}
            onBack={requestClose}
            backLabel={backLabel}
          />
        )}
      </div>
    </motion.div>,
    document.body,
  )
}
