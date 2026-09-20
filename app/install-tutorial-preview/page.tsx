import { notFound } from 'next/navigation'
import { InstallTutorial } from '@/components/install-tutorial'
import type { InstallTutorialPlatform } from '@/lib/install-tutorial'

export const metadata = {
  title: 'Install tutorial preview',
  robots: { index: false, follow: false },
}

const PLATFORMS = new Set<InstallTutorialPlatform>([
  'ios',
  'android',
  'windows',
  'generic',
])

type PageProps = {
  searchParams: Promise<{ platform?: string }>
}

/** Dev/preview only: install tutorial at 375px (?platform=ios|android|windows). */
export default async function InstallTutorialPreviewPage({
  searchParams,
}: PageProps) {
  if (process.env.NODE_ENV === 'production') notFound()

  const raw = (await searchParams).platform ?? 'ios'
  const platform: InstallTutorialPlatform = PLATFORMS.has(
    raw as InstallTutorialPlatform,
  )
    ? (raw as InstallTutorialPlatform)
    : 'ios'

  return (
    <main className="mx-auto flex min-h-svh max-w-[375px] flex-col justify-center bg-background px-4 py-8">
      <div className="is-panel rounded-2xl border border-gold/20 p-4 shadow-2xl">
        <InstallTutorial platform={platform} />
      </div>
    </main>
  )
}
