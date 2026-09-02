import { notFound } from 'next/navigation'
import {
  checkSavedSharedSplitAction,
  getPublicSharedSplitByToken,
} from '@/lib/data/split-share'
import { PublicSplitShareClient } from '@/components/public-split-share-view'
import { createClient } from '@/lib/supabase/server'
import { buildAuthEntryHref } from '@/lib/auth-entry'

type PageProps = {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params
  const split = await getPublicSharedSplitByToken(token)
  return {
    title: split ? `${split.name} — IRONSTACK` : 'Shared split — IRONSTACK',
    description: split?.description ?? 'View and save a shared workout split.',
  }
}

export default async function PublicSplitSharePage({ params }: PageProps) {
  const { token } = await params
  const split = await getPublicSharedSplitByToken(token)
  if (!split) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const returnPath = `/share/split/${encodeURIComponent(token)}`
  const loginHref = buildAuthEntryHref({
    mode: 'signup',
    next: returnPath,
  })

  const savedState = user
    ? await checkSavedSharedSplitAction({
        splitId: split.id,
        shareToken: split.shareToken,
      })
    : { saved: false, owned: false }

  return (
    <div className="min-h-svh bg-background">
      <PublicSplitShareClient
        split={split}
        viewerUserId={user?.id ?? null}
        initialSaved={savedState.saved}
        initialOwned={savedState.owned}
        initialSavedCopyId={savedState.savedCopyId ?? null}
        returnPath={returnPath}
        loginHref={loginHref}
      />
    </div>
  )
}
