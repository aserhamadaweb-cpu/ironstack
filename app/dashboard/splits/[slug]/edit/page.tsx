import { notFound, redirect } from 'next/navigation'
import { PageError } from '@/components/page-states'
import { SplitBuilder, type SplitBuilderInitial } from '@/components/split-builder'
import { getProfile, getSplitDetail } from '@/lib/data/queries'
import { toSplitDetail } from '@/lib/data/split-adapter'
import { initialsFrom } from '@/lib/dashboard-utils'
import {
  enrichSplitFromLibrary,
  loadExerciseLibrary,
  resolveLibraryExercise,
} from '@/lib/exercise-library.server'
import type { LibraryExercise } from '@/lib/exercise-library'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params) {
  const { slug } = await params
  const result = await getSplitDetail(slug)
  return {
    title: result.data
      ? `Edit ${result.data.name} — IRONSTACK`
      : 'Edit Split — IRONSTACK',
    description: 'Edit your custom training split.',
  }
}

function toBuilderInitial(
  detail: ReturnType<typeof toSplitDetail>,
): SplitBuilderInitial {
  return {
    name: detail.name,
    description: detail.description,
    daysPerWeek: detail.daysPerWeek,
    days: detail.schedule.map((day, dayIndex) => ({
      id: day.id || `day-${dayIndex}`,
      name: day.focus,
      subtitle: day.note || null,
      exercises: day.exercises.map((exercise, exIndex) => {
        const resolved =
          resolveLibraryExercise(exercise.name) ??
          ({
            id: exercise.liftTypeId || `custom-${dayIndex}-${exIndex}`,
            name: exercise.name,
            muscles: [exercise.muscle],
            equipment: 'None',
            level: '',
            category: null,
            image: exercise.image ?? null,
          } satisfies LibraryExercise)

        return {
          uid: `ex-${dayIndex}-${exIndex}`,
          exercise: resolved,
          sets: exercise.sets || 3,
          reps: exercise.reps || '8–12',
          setType: 'normal' as const,
        }
      }),
    })),
  }
}

export default async function EditSplitPage({ params }: Params) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [splitResult, profileResult] = await Promise.all([
    getSplitDetail(slug),
    getProfile(user.id),
  ])

  if (splitResult.error || profileResult.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError
          message={splitResult.error || profileResult.error || 'Error'}
        />
      </main>
    )
  }

  if (!splitResult.data) notFound()

  const raw = splitResult.data
  if (raw.user_id !== user.id || raw.is_system) {
    redirect(`/dashboard/splits/${slug}`)
  }

  const detail = enrichSplitFromLibrary(toSplitDetail(raw))
  const displayName =
    profileResult.data?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <SplitBuilder
      library={loadExerciseLibrary()}
      displayName={displayName}
      initials={initialsFrom(displayName)}
      mode="edit"
      editSplitId={raw.id}
      initial={toBuilderInitial(detail)}
    />
  )
}
