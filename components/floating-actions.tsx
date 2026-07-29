'use client'

import Link from 'next/link'
import { Bot, Dumbbell } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.89 3l-.2.37a18.3 18.3 0 0 1 4.5 2.16 15.5 15.5 0 0 0-14.38 0A18.3 18.3 0 0 1 10.3 3.37 19.7 19.7 0 0 0 5.9 4.38C2.57 9.27 1.71 14.03 2.1 18.73a19.9 19.9 0 0 0 5.98 3.01l.8-1.35a12.9 12.9 0 0 1-1.9-.92l.46-.36c3.65 1.7 7.61 1.7 11.22 0l.46.36c-.61.36-1.25.66-1.91.92l.8 1.35a19.9 19.9 0 0 0 5.98-3.01c.46-5.45-.78-10.17-3.67-14.36ZM8.7 15.6c-1.1 0-2-.98-2-2.18s.88-2.18 2-2.18 2.02 1 2 2.18-.88 2.18-2 2.18Zm6.6 0c-1.1 0-2-.98-2-2.18s.88-2.18 2-2.18 2.02 1 2 2.18-.9 2.18-2 2.18Z" />
    </svg>
  )
}

/** Floating Discord + AI Coach buttons pinned to the bottom-right corner. */
export function FloatingActions() {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className="fixed right-4 bottom-[5.25rem] z-50 flex flex-col items-center gap-3 md:right-6 md:bottom-6"
      initial={{ opacity: 0, scale: 0.5, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.8, type: 'spring', stiffness: 240, damping: 18 }}
    >
      <a
        href="https://discord.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join our Discord"
        className="flex size-12 items-center justify-center rounded-full border border-[#5865F2]/60 bg-[#5865F2] text-white shadow-[0_8px_26px_-8px_rgba(88,101,242,0.7)] transition-transform duration-200 hover:scale-110 active:scale-95"
      >
        <DiscordIcon className="size-6" />
      </a>

      <Link
        href="/dashboard/ai-coach"
        aria-label="Open AI Coach"
        className="group relative flex size-14 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-[0_8px_30px_-6px_rgba(242,241,237,0.35)] transition-transform duration-200 hover:scale-110 active:scale-95"
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
        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-gold">
          <Dumbbell className="size-2.5 text-background" aria-hidden="true" />
        </span>
      </Link>
    </motion.div>
  )
}
