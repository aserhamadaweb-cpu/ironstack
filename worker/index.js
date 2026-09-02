/* IronStack custom service worker — push notifications.
 * Merged into next-pwa's generated sw.js (do not register a second worker).
 * App-shell / static asset caching lives in next.config.mjs runtimeCaching.
 */

self.addEventListener('push', (event) => {
  let data = { title: 'IRONSTACK', body: '', link: '/dashboard/home' }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {
    try {
      const text = event.data?.text()
      if (text) data.body = text
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'IRONSTACK', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { link: data.link || '/dashboard/home' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link =
    (event.notification.data && event.notification.data.link) ||
    '/dashboard/home'
  const url = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(
      (clients) => {
        for (const client of clients) {
          if ('focus' in client && client.url.startsWith(self.location.origin)) {
            client.navigate(url)
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url)
        }
        return undefined
      },
    ),
  )
})

/* App shell: precache the offline document so a cold launch with no network
 * can still render. next-pwa only precaches hashed JS/CSS, not HTML routes. */
const SHELL_CACHE = 'pages'
const SHELL_URLS = [
  '/offline',
  '/offline/exercises.json',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL_URLS.map((url) =>
          cache
            .add(new Request(url, { credentials: 'same-origin' }))
            .catch(() => undefined),
        ),
      ),
    ),
  )
})

async function matchCached(request) {
  const exact = await caches.match(request, { ignoreSearch: true })
  if (exact) return exact
  const url = new URL(request.url)
  return caches.match(url.pathname, { ignoreSearch: true })
}

async function navigationResponse(request) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (response && (response.ok || response.type === 'opaqueredirect')) {
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE)
        void cache.put(request, response.clone())
      }
      return response
    }
  } catch {
    /* offline or timeout */
  }

  const cached = await matchCached(request)
  if (cached) return cached

  const offline = await caches.match('/offline', { ignoreSearch: true })
  if (offline) {
    const reqUrl = new URL(request.url)
    if (reqUrl.pathname !== '/offline') {
      const dest = new URL('/offline', request.url)
      const ret = reqUrl.pathname + reqUrl.search
      if (ret.startsWith('/') && !ret.startsWith('//')) {
        dest.searchParams.set('return', ret)
      }
      return Response.redirect(dest, 302)
    }
    return offline
  }

  return Response.error()
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (request.mode !== 'navigate') return
  try {
    if (new URL(request.url).origin !== self.location.origin) return
  } catch {
    return
  }
  event.respondWith(navigationResponse(request))
})
