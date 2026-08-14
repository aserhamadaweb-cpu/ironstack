'use client'

import Link from 'next/link'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { useState } from 'react'
import { GetAppButton } from '@/components/get-app-button'
import { IronStackMark } from '@/components/ironstack-mark'
import { EASE } from '@/components/reveal'

export function Navbar() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > 24)
  })

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      <nav
        aria-label="Main navigation"
        className={`mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 rounded-full border px-3 py-2 backdrop-blur-md transition-all duration-200 sm:px-6 ${
          scrolled
            ? 'border-border/80 bg-background/80 shadow-[var(--panel-shadow)]'
            : 'border-transparent bg-transparent shadow-none'
        }`}
      >
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-full px-1 active:opacity-80"
        >
          <IronStackMark size="sm" className="shrink-0" />
          <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
            IRONSTACK
          </span>
        </Link>

        <GetAppButton
          compact
          label="GET APP"
          className="btn-pill btn-pill-primary min-h-11 shrink-0 px-4 py-2 text-[10px] tracking-[0.18em] sm:px-5 sm:text-xs"
        />
      </nav>
    </motion.header>
  )
}
