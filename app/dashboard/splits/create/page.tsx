import { redirect } from 'next/navigation'
import { SplitBuilder } from '@/components/split-builder'
import { loadExerciseLibrary } from '@/lib/exercise-library.server'
import { initialsFrom } from '@/lib/dashboard-utils'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Create Your Own Split — IRONSTACK',
  description: 'Build a custom training split from 800+ exercises.',
}

export default async function CreateSplitPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { count } = await supabase
    .from('splits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_system', false)

  if ((count ?? 0) >= MAX_CUSTOM_SPLITS) {
    redirect('/dashboard/workout')
  }

  const metadataName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : ''
  const displayName = metadataName || user.email?.split('@')[0] || 'Athlete'

  const library = loadExerciseLibrary()

  return (
    <SplitBuilder
      library={library}
      displayName={displayName}
      initials={initialsFrom(displayName)}
      customSplitCount={count ?? 0}
      maxCustomSplits={MAX_CUSTOM_SPLITS}
    />
  )
}
