/**
 * Guest-login network audit: count RSC/dashboard prefetch after landing on home.
 * Run with dev server up: node scripts/audit-perf-guest-network.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000'
const OUT = path.join(ROOT, 'audit-perf-guest-network-output.txt')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const lines = []
  const log = (s) => {
    lines.push(s)
    console.log(s)
  }

  /** @type {{url:string, type:string}[]} */
  const afterHome = []
  let capturing = false

  page.on('request', (req) => {
    if (!capturing) return
    const url = req.url()
    afterHome.push({ url, type: req.resourceType() })
  })

  log(`BASE ${BASE}`)
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)

  // Dismiss language gate if present
  const langBtn = page.locator('button, a').filter({ hasText: /English|Continue|العربية/i }).first()
  if (await langBtn.isVisible().catch(() => false)) {
    await langBtn.click().catch(() => undefined)
    await page.waitForTimeout(800)
  }

  const guest = page.getByRole('button', { name: /guest|زائر/i })
  if (!(await guest.isVisible().catch(() => false))) {
    log('SKIP: guest button not found (locale/auth UI)')
    fs.writeFileSync(OUT, lines.join('\n'))
    await browser.close()
    return
  }

  capturing = true
  await guest.click()
  log('Clicked continue as guest…')
  await page.waitForURL(/\/dashboard\//, { timeout: 90000 }).catch(() => undefined)
  // Include idle prefetch window (requestIdleCallback timeout 4s + buffer)
  await page.waitForTimeout(7000)
  capturing = false
  const t0 = Date.now() // kept for log shape

  const dashboardPaths = afterHome
    .map((h) => {
      try {
        const u = new URL(h.url)
        return {
          path: u.pathname,
          rsc: u.searchParams.has('_rsc') || h.url.includes('_rsc'),
          type: h.type,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const rscDashboard = dashboardPaths.filter(
    (h) => h.rsc || (h.path.startsWith('/dashboard') && h.type !== 'image'),
  )
  const uniqueRsc = [
    ...new Set(
      rscDashboard
        .filter((h) => h.path.startsWith('/dashboard'))
        .map((h) => h.path),
    ),
  ].sort()

  const catalog = afterHome.filter((h) => h.url.includes('/offline/exercises.json'))

  log(`Landed URL: ${page.url()}`)
  log(`Capture window ms: ${Date.now() - t0}`)
  log(`Total requests in window: ${afterHome.length}`)
  log(`Unique /dashboard paths touched: ${uniqueRsc.length}`)
  for (const p of uniqueRsc) log(`  ${p}`)
  log(`exercises.json in window: ${catalog.length}`)
  log(
    `\nExpect after fix: only primary tabs (~home/workout/profile) + current route, not 15 sidebar destinations.`,
  )

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
  await browser.close()
}

await main()
