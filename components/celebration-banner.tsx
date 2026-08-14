'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Trophy, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EASE } from '@/components/reveal'
import { markCelebrationsBannerShownAction } from '@/lib/ai/celebration-actions'

export type CelebrationBannerItem = {
  id: string
  title: string
  body: string | null
}

type CelebrationBannerProps = {
  items: CelebrationBannerItem[]
}

export function CelebrationBanner({ items }: CelebrationBannerProps) {
  const reduce = useReducedMotion()
  const [visible, setVisible] = useState(items)
  const markedRef = useRef(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setVisible(items)
    markedRef.current = false
  }, [items])

  // Mark banner_shown once when the celebration is displayed.
  useEffect(() => {
    if (visible.length === 0 || markedRef.current) return
    markedRef.current = true
    const ids = visible.map((v) => v.id)
    startTransition(async () => {
      await markCelebrationsBannerShownAction(ids)
    })
  }, [visible, startTransition])

  if (visible.length === 0) return null

  const title =
    visible.length === 1
      ? visible[0].title
      : `${visible.length} new PRs to celebrate!`
  const body =
    visible.length === 1
      ? visible[0].body
      : visible.map((v) => v.title).join(' · ')

  const dismiss = () => {
    setVisible([])
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : -8 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="is-panel mb-4 overflow-hidden border-heat/30 p-4 shadow-[0_0_40px_-14px_rgba(198,40,40,0.45)]"
        role="status"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-heat/40 bg-heat-tint text-heat">
            <Trophy className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-kicker text-heat">CELEBRATION</p>
            <p className="font-heading mt-1 text-lg font-bold text-headline">
              {title}
            </p>
            {body && (
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss celebration"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
