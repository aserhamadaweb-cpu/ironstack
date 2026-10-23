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

const SESSION_SYNC_TAG = 'ironstack-session-sync'
const OFFLINE_DB = 'ironstack-offline'

function openOfflineDb() {
  return new Promise((resolve) => {
    const request = indexedDB.open(OFFLINE_DB)
    request.onupgradeneeded = () => {
      try {
        request.transaction.abort()
      } catch {
        /* empty database — nothing queued */
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function readUnsyncedSessions(db) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('sessions')) {
      resolve([])
      return
    }
    const tx = db.transaction('sessions', 'readonly')
    const request = tx.objectStore('sessions').getAll()
    request.onsuccess = () => {
      const rows = Array.isArray(request.result) ? request.result : []
      resolve(rows.filter((row) => row && row.syncStatus !== 'synced'))
    }
    request.onerror = () => reject(request.error)
  })
}

function markSessionsSynced(db, ids) {
  return new Promise((resolve, reject) => {
    if (ids.length === 0 || !db.objectStoreNames.contains('sessions')) {
      resolve()
      return
    }
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    for (const id of ids) {
      const getRequest = store.get(id)
      getRequest.onsuccess = () => {
        const row = getRequest.result
        if (!row) return
        row.syncStatus = 'synced'
        row.syncError = null
        row.updatedAt = new Date().toISOString()
        store.put(row)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function syncPendingSessions() {
  const db = await openOfflineDb()
  if (!db) return
  let pending = []
  try {
    pending = await readUnsyncedSessions(db)
  } catch {
    db.close()
    throw new Error('Could not read queued sessions')
  }
  if (pending.length === 0) {
    db.close()
    return
  }
  const sessions = pending.map((row) => ({
    id: row.id,
    splitId: row.splitId,
    splitDayId: row.splitDayId,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    durationSeconds: row.durationSeconds ?? null,
    logs: Array.isArray(row.logs) ? row.logs : [],
    prs: Array.isArray(row.prs) ? row.prs : [],
  }))
  const response = await fetch('/api/offline/background-sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions }),
  })
  if (response.status === 401) {
    db.close()
    throw new Error('Sign-in expired')
  }
  if (!response.ok && response.status !== 207) {
    db.close()
    throw new Error('Session sync failed')
  }
  const body = await response.json().catch(() => ({ ok: [] }))
  const ok = Array.isArray(body.ok) ? body.ok : []
  await markSessionsSynced(db, ok)
  db.close()
  if (!Array.isArray(body.ok) || body.ok.length < sessions.length) {
    throw new Error('Some sessions are still queued')
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag !== SESSION_SYNC_TAG) return
  event.waitUntil(syncPendingSessions())
})

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
