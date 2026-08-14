'use client'

import Link from 'next/link'
import { useRef } from 'react'
import Image from 'next/image'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from 'framer-motion'
import { GetAppButton } from '@/components/get-app-button'
import { IronStackMark } from '@/components/ironstack-mark'
import { EASE } from '@/components/reveal'

const HEADLINE = ['TRAIN', 'SMARTER.', 'FEEL', 'STRONGER.']

export function Hero() {
  const reduce = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 140])

  const container: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.09, delayChildren: 0.1 },
    },
  }

  const rise: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE },
    },
  }

  const lineVariants: Variants = {
    hidden: { scaleX: 0, opacity: 0 },
    visible: {
      scaleX: 1,
      opacity: 1,
      transition: { duration: 0.7, ease: EASE },
    },
  }

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-svh items-center justify-center overflow-hidden"
    >
      <motion.div
        className="absolute inset-x-0 -top-[15%] h-[130%]"
        style={{ y: reduce ? 0 : parallaxY }}
        aria-hidden="true"
      >
        <Image
          src="/images/hero-gym.png"
          alt=""
          fill
          priority
          loading="eager"
          className="hero-zoom object-cover opacity-50"
        />
      </motion.div>
      <div
        className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background"
        aria-hidden="true"
      />

      <motion.div
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 text-center"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={rise}
          className="flex flex-col items-center gap-3"
        >
          <span className="relative flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-gold/30 bg-card sm:size-20">
            <IronStackMark size="lg" />
          </span>
          <p className="flex items-center gap-3 text-xs font-medium tracking-[0.4em] text-gold">
            <motion.span
              variants={lineVariants}
              className="h-px w-8 origin-right bg-gold/60"
              aria-hidden="true"
            />
            <span className="inline-flex items-center gap-2">IRONSTACK</span>
            <motion.span
              variants={lineVariants}
              className="h-px w-8 origin-left bg-gold/60"
              aria-hidden="true"
            />
          </p>
        </motion.div>

        <h1 className="font-heading text-metallic text-balance text-4xl font-bold leading-[1.05] tracking-tight drop-shadow-[0_8px_40px_rgba(0,0,0,0.55)] sm:text-5xl md:text-7xl">
          {HEADLINE.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              variants={rise}
              className="mr-2 inline-block last:mr-0 sm:mr-3"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={rise}
          className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Log lifts, run challenges with friends, and keep your streak lit —
          install IronStack to your home screen like a native gym app.
        </motion.p>

        <motion.div
          variants={rise}
          className="flex w-full flex-col items-center gap-4"
        >
          <Link
            href="/login"
            className="cta-pulse btn-pill min-h-14 bg-gold px-10 py-4 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_28px_-8px_rgba(232,181,74,0.55)] transition-transform duration-200 active:scale-[0.98]"
          >
            SIGN IN
          </Link>
          <GetAppButton />
        </motion.div>
      </motion.div>
    </section>
  )
}
