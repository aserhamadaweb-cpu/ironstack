'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from 'framer-motion'
import { EASE } from '@/components/reveal'

const MotionLink = motion.create(Link)

// Headline split into words so each can stagger in sequence.
const HEADLINE = ['TRAIN', 'SMARTER.', 'FEEL', 'STRONGER.']

export function Hero() {
  const reduce = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  // Parallax: background drifts slower than the page as you scroll past the hero.
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

  // Eyebrow rule lines grow outward from the center label.
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
        <motion.p
          variants={rise}
          className="flex items-center gap-3 text-xs font-medium tracking-[0.4em] text-gold"
        >
          <motion.span
            variants={lineVariants}
            className="h-px w-8 origin-right bg-gold/60"
            aria-hidden="true"
          />
          WELCOME TO IRONSTACK
          <motion.span
            variants={lineVariants}
            className="h-px w-8 origin-left bg-gold/60"
            aria-hidden="true"
          />
        </motion.p>

        <h1 className="font-heading text-metallic text-balance text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          {HEADLINE.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              variants={rise}
              className="mr-3 inline-block last:mr-0"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={rise}
          className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Your friendly training companion — track your progress, get smart
          coaching tips, and celebrate every win along the way.
        </motion.p>

        <MotionLink
          href="/login"
          variants={rise}
          whileHover={reduce ? undefined : { scale: 1.05 }}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="cta-pulse rounded-full bg-primary px-10 py-4 text-sm font-bold tracking-[0.25em] text-primary-foreground hover:brightness-110"
        >
          GET STARTED
        </MotionLink>
      </motion.div>
    </section>
  )
}
