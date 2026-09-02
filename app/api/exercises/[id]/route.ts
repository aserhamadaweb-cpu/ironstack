import { NextResponse } from 'next/server'
import { resolveExerciseDetail } from '@/lib/exercises/resolve-detail'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const name = new URL(request.url).searchParams.get('name') ?? undefined
  const exercise = resolveExerciseDetail(id, name)
  if (!exercise) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(exercise, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
