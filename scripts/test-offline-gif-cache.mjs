/**
 * Reproduces offline GIF cache put/match behavior (page Cache API + SW).
 * Serves public/exercises via a tiny static server so we don't need Next.
 *
 * Run: node scripts/test-offline-gif-cache.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const GIF_REL = '/exercises/gifs/0043-qXTaZnJ.gif'
const GIF_FILE = path.join(ROOT, 'public', 'exercises', 'gifs', '0043-qXTaZnJ.gif')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  assert(fs.existsSync(GIF_FILE), `Missing fixture GIF: ${GIF_FILE}`)

  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] || '/'
    if (url === GIF_REL) {
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=0',
      })
      fs.createReadStream(GIF_FILE).pipe(res)
      return
    }
    if (url === '/' || url === '/app') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!doctype html><html><body><h1>gif cache test</h1></body></html>`)
      return
    }
    res.writeHead(404)
    res.end('missing')
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const origin = `http://127.0.0.1:${port}`

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`${origin}/app`)

  const result = await page.evaluate(async (gifPath) => {
    const GIF_CACHE = 'exercise-gifs'
    const absolute = new URL(gifPath, location.origin).href

    // Mimic current prefetch: relative key
    const cache = await caches.open(GIF_CACHE)
    const res = await fetch(gifPath, { credentials: 'same-origin' })
    if (!res.ok) return { step: 'fetch', ok: false, status: res.status }
    await cache.put(gifPath, res.clone())

    const matchRelative = await cache.match(gifPath)
    const matchAbsolute = await cache.match(absolute)
    const matchRequest = await cache.match(new Request(absolute))

    // Also store absolute key (proposed fix)
    await cache.put(absolute, res.clone())
    const matchAbsAfterAbsPut = await cache.match(new Request(absolute))

    // Simulate offline img load via cache lookup only
    await new Promise((r) => setTimeout(r, 50))

    return {
      step: 'ok',
      status: res.status,
      matchRelative: Boolean(matchRelative?.ok),
      matchAbsolute: Boolean(matchAbsolute?.ok),
      matchRequest: Boolean(matchRequest?.ok),
      matchAbsAfterAbsPut: Boolean(matchAbsAfterAbsPut?.ok),
      keys: (await cache.keys()).map((k) => k.url),
    }
  }, GIF_REL)

  // Offline navigation: set offline and try fetch through page
  await page.context().setOffline(true)
  const offlineFetch = await page.evaluate(async (gifPath) => {
    const absolute = new URL(gifPath, location.origin).href
    const cache = await caches.open('exercise-gifs')
    try {
      const network = await fetch(absolute)
      return { networkOk: network.ok, via: 'network' }
    } catch (err) {
      const hit = await cache.match(new Request(absolute))
      return {
        networkOk: false,
        cacheHit: Boolean(hit?.ok),
        error: String(err?.message || err),
      }
    }
  }, GIF_REL)

  await browser.close()
  server.close()

  console.log('prefetch-style put/match:', result)
  console.log('offline fetch:', offlineFetch)

  assert(result.step === 'ok', 'prefetch fetch failed')
  assert(result.matchRelative, 'relative cache.match failed after relative put')
  // Document whether absolute Request matches relative put
  console.log(
    'CAUSE HINT: absolute Request match after relative put =',
    result.matchAbsolute,
    result.matchRequest,
  )

  if (!offlineFetch.cacheHit && !offlineFetch.networkOk) {
    console.log('FAIL: offline cannot get GIF from cache via absolute Request')
    process.exit(1)
  }

  console.log('PASS — cache contains GIF and absolute Request can read it')
}

main().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
