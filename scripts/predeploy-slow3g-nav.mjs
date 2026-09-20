/**
 * Slow 3G soft-nav: expect honest connection banner (not silent stay).
 * Requires production or dev server. PERF_BASE_URL default http://127.0.0.1:3000
 */
import { chromium } from 'playwright'

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000'

async function pickEnglish(page) {
  const eng = page.locator('button').filter({ hasText: /English/i }).first()
  if (await eng.isVisible().catch(() => false)) {
    await eng.click()
    await page.waitForTimeout(800)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  })
  const page = await context.newPage()

  // Auth + language on a normal connection first
  await page.goto(BASE + '/login', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await page.waitForTimeout(1000)
  await pickEnglish(page)
  await page.getByRole('button', { name: /guest/i }).click({ timeout: 30000 })
  await page.waitForURL(/\/dashboard\//, { timeout: 120000 })
  console.log('landed', page.url())
  await page.waitForTimeout(2000)

  // Throttle after we're on home
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 2500,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    connectionType: 'cellular3g',
  })

  // Prefer bottom tabbar (375px); sidebar tour attrs are off-screen when menu closed.
  const tabWorkout = page.locator(
    'nav[data-tour="nav-tabbar"] a[href="/dashboard/workout"]',
  )
  if (await tabWorkout.count()) {
    await tabWorkout.first().click({ force: true })
  } else {
    // Already on workout tab or no link — force soft-nav intent via evaluate
    await page.evaluate(() => {
      const a = document.createElement('a')
      a.href = '/dashboard/analytics'
      a.textContent = 'go'
      document.body.appendChild(a)
      a.click()
    })
  }

  let banner = null
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(1000)
    const statuses = await page.locator('[role="status"]').allTextContents()
    const joined = statuses.join('\n')
    const body = await page.locator('body').innerText()
    const hit =
      joined.match(
        /Connection is slow|Couldn't load|Loading…|الاتصال بطيء|تعذّر تحميل|جارٍ التحميل/i,
      ) ||
      body.match(
        /Connection is slow|Couldn't load this page|الاتصال بطيء|تعذّر تحميل/i,
      )
    if (hit) {
      banner = hit[0]
      console.log('banner at', i + 1, 's:', banner)
      break
    }
    console.log('t+' + (i + 1) + 's url=' + page.url())
  }

  console.log('final url', page.url())
  if (!banner) {
    const ok = page.url().includes('/dashboard/workout')
    console.log(
      ok
        ? 'NOTE: no banner (nav completed under Slow 3G before fail threshold)'
        : 'FAIL: stuck without banner',
    )
    if (!ok) process.exitCode = 1
  } else {
    console.log('slow3g-nav: honest UI ok')
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
