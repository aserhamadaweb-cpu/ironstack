import Image from 'next/image'
import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden">
      <Image
        src="/images/hero-gym.png"
        alt=""
        fill
        priority
        className="object-cover opacity-50"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 text-center">
        <p className="fade-up flex items-center gap-3 text-xs font-medium tracking-[0.4em] text-gold">
          <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
          ELITE ACCESS ONLY
          <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
        </p>

        <h1
          className="fade-up font-heading text-metallic text-balance text-5xl font-bold leading-tight tracking-tight md:text-7xl"
          style={{ animationDelay: '0.15s' }}
        >
          THE APEX OF HUMAN PERFORMANCE.
        </h1>

        <p
          className="fade-up max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
          style={{ animationDelay: '0.3s' }}
        >
          Where Elite Strength Meets Intelligent Engineering.
        </p>

        <Link
          href="#pr-arena"
          className="cta-pulse fade-up rounded-full bg-primary px-10 py-4 text-sm font-bold tracking-[0.25em] text-primary-foreground transition-transform hover:scale-105"
          style={{ animationDelay: '0.45s' }}
        >
          ENTER THE ARENA
        </Link>
      </div>
    </section>
  )
}
