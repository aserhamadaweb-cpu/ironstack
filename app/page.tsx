import { Footer } from '@/components/footer'
import { FeatureGrid } from '@/components/feature-grid'
import { GetAppButton } from '@/components/get-app-button'
import { Hero } from '@/components/hero'
import { Navbar } from '@/components/navbar'
import { StandaloneRedirect } from '@/components/standalone-redirect'
import { WhyIronStack } from '@/components/why-ironstack'
import Link from 'next/link'

export default function Page() {
  return (
    <StandaloneRedirect>
      <Navbar />
      <main>
        <Hero />
        <FeatureGrid />
        <WhyIronStack />
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-24 text-center">
          <p className="text-xs font-medium tracking-[0.4em] text-gold">
            READY WHEN YOU ARE
          </p>
          <h2 className="font-heading text-metallic text-2xl font-bold sm:text-3xl">
            INSTALL IRONSTACK
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Add it to your home screen for a full-screen, app-like experience —
            no store download required.
          </p>
          <div className="flex w-full flex-col items-center gap-4">
            <Link
              href="/login"
              className="cta-pulse btn-pill min-h-14 bg-gold px-10 py-4 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_28px_-8px_rgba(232,181,74,0.55)] transition-transform duration-200 active:scale-[0.98]"
            >
              SIGN IN
            </Link>
            <GetAppButton />
          </div>
        </section>
      </main>
      <Footer />
    </StandaloneRedirect>
  )
}
