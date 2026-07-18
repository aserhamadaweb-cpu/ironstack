import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { FeatureGrid } from '@/components/feature-grid'
import { IronCircle } from '@/components/iron-circle'
import { Footer } from '@/components/footer'

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeatureGrid />
        <IronCircle />
      </main>
      <Footer />
    </>
  )
}
