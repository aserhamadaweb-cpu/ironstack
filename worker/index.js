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

/* App shell: precache offline assets only — never HTML route documents. */
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

/** Drop stale cached HTML from older builds — only keep the offline shell assets. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const keys = await cache.keys()
      await Promise.all(
        keys
          .filter((req) => {
            try {
              const path = new URL(req.url).pathname
              return (
                path !== '/offline' &&
                !path.endsWith('.json') &&
                !path.startsWith('/icons/')
              )
            } catch {
              return true
            }
          })
          .map((req) => cache.delete(req)),
      )
    }),
  )
})

async function navigationResponse(request) {
  const reqUrl = new URL(request.url)

  try {
    // No timeout: a slow network must still resolve to the requested page.
    // Timing out here used to bounce users back to the previous route.
    return await fetch(request)
  } catch {
    /* genuinely offline — fall through to the offline shell */
  }

  // Offline: show the offline shell with a return path — never a stale cached page.
  const offline = await caches.match('/offline', { ignoreSearch: true })
  if (offline) {
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
