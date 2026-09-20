import { CreateSplitClient } from '@/components/create-split-client'
import { GuestPageGate } from '@/components/guest-page-gate'

export const metadata = {
  title: 'Create Your Own Split — IRONSTACK',
  description: 'Build a custom training split from 1,300+ exercises.',
}

type Params = {
  searchParams: Promise<{ home?: string; tourAfterSave?: string }>
}

export default async function CreateSplitPage({ searchParams }: Params) {
  const { home, tourAfterSave } = await searchParams
  return (
    <GuestPageGate reason="createSplit" returnPath="/dashboard/splits/create">
      <CreateSplitClient
        defaultHomeLibrary={home === '1'}
        startTourAfterSave={tourAfterSave === '1'}
      />
    </GuestPageGate>
  )
}
