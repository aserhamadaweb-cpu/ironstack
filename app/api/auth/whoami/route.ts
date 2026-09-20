import { createClient, getAuthIdentity } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Authoritative session from HTTP cookies — used to reconcile stale client storage. */
export async function GET() {
  const { userId, email } = await getAuthIdentity()

  if (!userId) {
    return NextResponse.json(
      { userId: null, isAnonymous: false, email: null },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  }

  let isAnonymous = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isAnonymous = user?.is_anonymous === true
  } catch {
    /* keep isAnonymous false — server still has a user id from cookies */
  }

  return NextResponse.json(
    {
      userId,
      isAnonymous,
      email,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
