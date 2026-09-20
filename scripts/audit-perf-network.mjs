/**
 * Capture background/prefetch network traffic on dashboard shell routes.
 * Run with: node scripts/audit-perf-network.mjs
 * Requires: npm run dev on localhost:3000
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000'
const OUT = path.join(ROOT, 'audit-perf-network-output.txt')

function classify(url) {
  const u = url.toLowerCase()
  if (u.includes('_rsc') || u.includes('?_rsc=') || u.includes('/_next/data')) {
    return 'rsc-prefetch'
  }
  if (u.includes('/offline/exercises.json')) return 'exercise-catalog'
  if (u.includes('lift_types') || u.includes('personal_records')) return 'supabase-cache'
  if (u.includes('/_next/static')) return 'static'
  if (u.includes('/exercises/gifs/') || u.includes('/exercises/images/')) {
    return 'exercise-media'
  }
  if (u.includes('/api/')) return 'api'
  if (u.includes('supabase')) return 'supabase'
  return 'other'
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const hits = []

  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith('http')) return
    // Ignore playwright/devtools
    hits.push({
      t: Date.now(),
      method: req.method(),
      resourceType: req.resourceType(),
      url,
      kind: classify(url),
    })
  })

  const lines = []
  const log = (s) => {
    lines.push(s)
    console.log(s)
  }

  log(`BASE ${BASE}`)
  log('--- Visit / (landing) wait 4s ---')
  const t0 = Date.now()
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  } catch (err) {
    log(`goto failed: ${err.message}`)
  }
  await page.waitForTimeout(4000)
  const afterLanding = hits.length

  const byKindLanding = {}
  for (const h of hits) {
    byKindLanding[h.kind] = (byKindLanding[h.kind] || 0) + 1
  }
  log(`Requests after landing: ${afterLanding}`)
  log(`By kind: ${JSON.stringify(byKindLanding)}`)

  // Try dashboard home (likely redirects to login without auth)
  log('\n--- Visit /dashboard/home wait 6s (auth may redirect) ---')
  const beforeDash = hits.length
  try {
    await page.goto(BASE + '/dashboard/home', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
  } catch (err) {
    log(`dashboard goto: ${err.message}`)
  }
  await page.waitForTimeout(6000)
  const dashHits = hits.slice(beforeDash)
  const byKindDash = {}
  const rscUrls = []
  for (const h of dashHits) {
    byKindDash[h.kind] = (byKindDash[h.kind] || 0) + 1
    if (h.kind === 'rsc-prefetch' || h.url.includes('/dashboard/')) {
      const pathOnly = h.url.replace(BASE, '').split('?')[0]
      if (
        pathOnly.startsWith('/dashboard') ||
        h.url.includes('_rsc') ||
        h.resourceType === 'document'
      ) {
        rscUrls.push(`${h.method} ${pathOnly}${h.url.includes('_rsc') ? ' [?_rsc]' : ''} (${h.resourceType})`)
      }
    }
  }
  log(`New requests on dashboard attempt: ${dashHits.length}`)
  log(`By kind: ${JSON.stringify(byKindDash)}`)
  log(`Final URL: ${page.url()}`)

  // Dedupe path list
  const uniquePaths = [...new Set(rscUrls)]
  log(`\nDashboard-related / RSC-ish requests (${uniquePaths.length} unique):`)
  for (const u of uniquePaths.slice(0, 80)) log(`  ${u}`)

  // Check for exercise catalog
  const catalog = hits.filter((h) => h.kind === 'exercise-catalog')
  log(`\nexercises.json fetches: ${catalog.length}`)

  // If we landed on login, still note prefetch won't run (no DashboardNav)
  log(`\nElapsed ms: ${Date.now() - t0}`)
  log(
    '\nNOTE: Without auth cookies, DashboardNav PREFETCH_ROUTES may not run. Code audit still shows router.prefetch of 15 routes on every DashboardNav mount.',
  )

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
  await browser.close()
}

await main()
