'use client'

/** Convert a URL-safe base64 VAPID key to a Uint8Array for PushManager. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function subscribeToPush(): Promise<PushSubscription> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    throw new Error('Push is not configured (missing VAPID public key).')
  }

  const registration = await registerPushServiceWorker()
  await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })
}

export function subscriptionKeys(sub: PushSubscription): {
  endpoint: string
  p256dh: string
  authKey: string
} {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const authKey = json.keys?.auth
  if (!json.endpoint || !p256dh || !authKey) {
    throw new Error('Incomplete push subscription keys.')
  }
  return { endpoint: json.endpoint, p256dh, authKey }
}
