/* IronStack custom service worker — push notifications (merged into next-pwa sw.js in production). */

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
