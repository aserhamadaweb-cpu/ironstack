import { redirect } from 'next/navigation'
import { buildAuthEntryHref } from '@/lib/auth-entry'
import { safeAuthNextPath } from '@/lib/safe-next-path'

type ChooseLanguagePageProps = {
  searchParams: Promise<{ next?: string }>
}

/** Legacy route — forwards to /login?pickLanguage=1 */
export default async function ChooseLanguagePage({
  searchParams,
}: ChooseLanguagePageProps) {
  const params = await searchParams
  redirect(
    buildAuthEntryHref({
      next: safeAuthNextPath(params.next),
    }),
  )
}
