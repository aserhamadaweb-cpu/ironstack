'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Dumbbell } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useIsGuest } from '@/components/use-is-guest'

/** Hide during an in-progress workout so logging stays full-screen. */
function shouldHideFloating(pathname: string) {
  return (
    pathname.startsWith('/dashboard/ai-coach') ||
    /\/splits\/[^/]+\/session(?:\/|$)/.test(pathname)
  )
}

/** Floating AI Coach button pinned above the bottom tab bar. */
export function FloatingActions() {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const { isGuest } = useIsGuest()

  if (isGuest || shouldHideFloating(pathname)) return null

  return (
    <motion.div
      className="pointer-events-none fixed end-4 z-40 flex flex-col items-center gap-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.75rem)] sm:end-6"
      initial={reduce ? false : { opacity: 0, scale: 0.5, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 240, damping: 18 }}
    >
      <Link
        href="/dashboard/ai-coach"
        aria-label="Open AI Coach"
        className="pointer-events-auto group relative inline-flex size-14 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-[0_8px_30px_-6px_rgba(242,241,237,0.35)] transition-transform duration-200 active:scale-95"
      >
        {!reduce && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden="true"
          />
        )}
        <Bot className="size-7 text-primary-foreground" aria-hidden="true" />
        <span className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-gold">
          <Dumbbell className="size-2.5 text-background" aria-hidden="true" />
        </span>
      </Link>
    </motion.div>
  )
}
