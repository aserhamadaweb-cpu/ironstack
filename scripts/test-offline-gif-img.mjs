/**
 * Offline GIF root-cause checks:
 * A) Cache Storage warm alone does NOT feed <img> without a SW
 * B) Blob URL resolved from Cache Storage DOES feed <img> offline (app fix)
 * C) SW CacheFirst from warmed exercise-gifs also works
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const GIF_REL = '/exercises/gifs/0043-qXTaZnJ.gif'
const GIF_FILE = path.join(ROOT, 'public', 'exercises', 'gifs', '0043-qXTaZnJ.gif')

const SW_SOURCE = `
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/exercises/gifs/')) return;
  event.respondWith((async () => {
    const cache = await caches.open('exercise-gifs');
    const hit = await cache.match(event.request);
    if (hit) return hit;
    try {
      const res = await fetch(event.request);
      if (res.ok) await cache.put(event.request, res.clone());
      return res;
    } catch {
      return new Response('offline miss', { status: 503 });
    }
  })());
});
`

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  assert(fs.existsSync(GIF_FILE), 'missing gif fixture')

  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] || '/'
    if (url === GIF_REL) {
      res.writeHead(200, { 'Content-Type': 'image/gif' })
      fs.createReadStream(GIF_FILE).pipe(res)
      return
    }
    if (url === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      res.end(SW_SOURCE)
      return
    }
    if (url === '/app') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!doctype html><html><body>
        <img id="gif" width="120" height="120" alt="demo" />
        <script>
          window.warm = async () => {
            const cache = await caches.open('exercise-gifs');
            const absolute = new URL('${GIF_REL}', location.origin).href;
            const res = await fetch(absolute, { credentials: 'same-origin' });
            await cache.put(new Request(absolute), res.clone());
            return absolute;
          };
          window.blobFromCache = async (path) => {
            const absolute = new URL(path, location.origin).href;
            const cache = await caches.open('exercise-gifs');
            const hit = await cache.match(new Request(absolute));
            if (!hit || !hit.ok) return null;
            return URL.createObjectURL(await hit.blob());
          };
          window.loadImg = (src) => new Promise((resolve) => {
            const img = document.getElementById('gif');
            img.onload = () => resolve(img.naturalWidth > 0);
            img.onerror = () => resolve(false);
            img.src = src;
            setTimeout(() => resolve(img.naturalWidth > 0), 2500);
          });
        </script>
      </body></html>`)
      return
    }
    res.writeHead(404)
    res.end('no')
  })

  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true })

  // A) No SW — network URL offline fails
  {
    const page = await browser.newPage()
    await page.goto(`${origin}/app`)
    await page.evaluate(() => window.warm())
    await page.context().setOffline(true)
    const loaded = await page.evaluate(
      (path) => window.loadImg(path),
      GIF_REL,
    )
    console.log('A no-SW network src offline:', { loaded })
    assert(!loaded, 'expected network src to fail offline without SW')
    await page.close()
  }

  // B) No SW — blob from Cache Storage works (app fix path)
  {
    const page = await browser.newPage()
    await page.goto(`${origin}/app`)
    await page.evaluate(() => window.warm())
    await page.context().setOffline(true)
    const loaded = await page.evaluate(async (path) => {
      const blob = await window.blobFromCache(path)
      if (!blob) return false
      return window.loadImg(blob)
    }, GIF_REL)
    console.log('B no-SW blob-from-cache offline:', { loaded })
    assert(loaded, 'blob URL from Cache Storage should render offline')
    await page.close()
  }

  // C) With SW — network src offline works when cache warmed
  {
    const page = await browser.newPage()
    await page.goto(`${origin}/app`)
    await page.evaluate(() => window.warm())
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker.controller)
    await page.evaluate(() => window.warm())
    await page.context().setOffline(true)
    const loaded = await page.evaluate(
      (path) => window.loadImg(path),
      GIF_REL,
    )
    console.log('C with-SW network src offline:', { loaded })
    assert(loaded, 'SW should serve warmed GIF offline')
    await page.close()
  }

  await browser.close()
  server.close()
  console.log('PASS — offline GIF cause/fix matrix verified')
}

main().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
