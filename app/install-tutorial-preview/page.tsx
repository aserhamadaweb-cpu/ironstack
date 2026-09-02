import { notFound } from 'next/navigation'
import { InstallTutorial } from '@/components/install-tutorial'

export const metadata = {
  title: 'Install tutorial preview',
  robots: { index: false, follow: false },
}

/** Dev/preview: iOS install tutorial at 375px. */
export default function InstallTutorialPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="mx-auto flex min-h-svh max-w-[375px] flex-col justify-center bg-background px-4 py-8">
      <div className="is-panel rounded-2xl border border-gold/20 p-4 shadow-2xl">
        <InstallTutorial platform="ios" />
      </div>
    </main>
  )
}
