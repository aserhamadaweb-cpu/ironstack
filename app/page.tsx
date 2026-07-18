import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { FeatureGrid } from '@/components/feature-grid'
import { Footer } from '@/components/footer'

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeatureGrid />
      </main>
      <Footer />
    </>
  )
}
