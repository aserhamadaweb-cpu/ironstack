import webpush from 'web-push'
import type { PushSubscriptionRow } from '@/lib/database.types'

let configured = false

function ensureVapid() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject =
    process.env.VAPID_SUBJECT?.trim() || 'mailto:notifications@ironstack.app'
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured.')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type PushPayload = {
  title: string
  body?: string | null
  link?: string | null
}

export async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  ensureVapid()
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body ?? '',
        link: payload.link ?? '/dashboard/home',
      }),
    )
    return { ok: true }
  } catch (err) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 0
    // 404/410 = subscription expired — caller should delete it.
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, gone: true, error: 'Subscription expired.' }
    }
    const message = err instanceof Error ? err.message : 'Push failed.'
    return { ok: false, error: message }
  }
}
