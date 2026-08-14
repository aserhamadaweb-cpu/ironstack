import { NextResponse } from 'next/server'
import type { PushSubscriptionRow } from '@/lib/database.types'
import { sendPushToSubscription } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type WebhookBody = {
  type?: string
  table?: string
  record?: {
    user_id?: string
    title?: string
    body?: string | null
    link?: string | null
  }
  // Flat / test payload
  user_id?: string
  title?: string
  body?: string | null
  link?: string | null
}

function authorize(request: Request): boolean {
  const secret = process.env.PUSH_WEBHOOK_SECRET?.trim()
  if (!secret) return false

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  const header = request.headers.get('x-webhook-secret')
  return header === secret
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: WebhookBody
  try {
    payload = (await request.json()) as WebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const record = payload.record ?? payload
  const userId = record.user_id
  const title = record.title
  if (!userId || !title) {
    return NextResponse.json(
      { error: 'user_id and title are required.' },
      { status: 400 },
    )
  }

  try {
    const admin = createAdminClient()
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth_key')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (subs ?? []) as PushSubscriptionRow[]
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No subscriptions.' })
    }

    let sent = 0
    const goneEndpoints: string[] = []

    await Promise.all(
      rows.map(async (sub) => {
        const result = await sendPushToSubscription(sub, {
          title,
          body: record.body,
          link: record.link,
        })
        if (result.ok) sent += 1
        if (result.gone) goneEndpoints.push(sub.endpoint)
      }),
    )

    if (goneEndpoints.length > 0) {
      await admin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .in('endpoint', goneEndpoints)
    }

    return NextResponse.json({
      ok: true,
      sent,
      removed: goneEndpoints.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Push failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
