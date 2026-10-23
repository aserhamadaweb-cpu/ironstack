import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { ExerciseDetailClient } from '@/components/exercise-detail-client'
import { getExerciseById } from '@/lib/exercises/catalog'
import { getAuthIdentity } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/queries'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  const exercise = getExerciseById(id)
  return {
    title: exercise
      ? `${exercise.name} — IRONSTACK`
      : 'Exercise — IRONSTACK',
    description: exercise
      ? `${exercise.name} demonstration, muscles, equipment, and instructions.`
      : 'Exercise details.',
  }
}

export default async function ExerciseDetailPage({ params }: Params) {
  const { id } = await params
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const exercise = getExerciseById(id)
  if (!exercise) notFound()

  const profileResult = await getProfile(userId)
  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'

  return (
    <>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <BackToTrainLink />
        <Suspense fallback={null}>
          <ExerciseDetailClient exercise={exercise} />
        </Suspense>
      </main>
    </>
  )
}
