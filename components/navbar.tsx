'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { EASE } from '@/components/reveal'

const links = [
  { label: 'AI ASSISTANT', href: '#ai-assistant' },
  { label: 'LIFT TRACKER', href: '#lift-tracker' },
  { label: 'COMMUNITY CIRCLE', href: '#community-circle' },
]

export function Navbar() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > 24)
  })

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <motion.nav
        aria-label="Main navigation"
        className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-full border px-6 py-3 backdrop-blur-md transition-colors duration-300"
        animate={{
          backgroundColor: scrolled
            ? 'rgba(18, 18, 20, 0.72)'
            : 'rgba(18, 18, 20, 0)',
          borderColor: scrolled
            ? 'rgba(214, 214, 224, 0.18)'
            : 'rgba(214, 214, 224, 0)',
          boxShadow: scrolled
            ? '0 12px 32px -18px rgba(0, 0, 0, 0.8)'
            : '0 0 0 0 rgba(0, 0, 0, 0)',
        }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform duration-300 hover:scale-105"
        >
          <Dumbbell className="size-5 text-gold" aria-hidden="true" />
          <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
            IRONSTACK
          </span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="link-underline text-xs font-medium tracking-[0.2em] text-silver-dim transition-colors duration-300 hover:text-gold"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/login"
          className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-foreground transition-all duration-300 hover:scale-105 hover:border-gold/40 hover:text-gold"
        >
          JOIN US
        </Link>
      </motion.nav>
    </motion.header>
  )
}
