/**
 * Capture React #310 with source-mapped stacks (productionBrowserSourceMaps).
 */
import { chromium } from 'playwright'

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const bag = { pageerrors: [], consoles: [] }

  page.on('pageerror', (e) => {
    bag.pageerrors.push({ message: e.message, stack: e.stack || '' })
  })
  page.on('console', async (m) => {
    const text = m.text()
    if (!/hook|310|Warning|Error|Rendered more|component stack/i.test(text)) {
      return
    }
    const loc = m.location()
    let args = []
    try {
      args = await Promise.all(
        m.args().map(async (a) => {
          try {
            return await a.jsonValue()
          } catch {
            return String(a)
          }
        }),
      )
    } catch {
      /* ignore */
    }
    bag.consoles.push({ type: m.type(), text, loc, args })
  })

  await page.goto(BASE + '/login', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  })
  await page.waitForTimeout(1200)
  const eng = page.locator('button').filter({ hasText: /English/i }).first()
  if (await eng.isVisible().catch(() => false)) {
    await eng.click()
    await page.waitForTimeout(900)
  }
  await page.getByRole('button', { name: /guest/i }).click({ timeout: 30000 })
  await page.waitForURL(/dashboard/, { timeout: 120000 })
  await page.waitForTimeout(2000)

  // Soft navigate via profile tab if present, else hard goto
  const tabProfile = page.locator('nav[data-tour="nav-tabbar"] a').filter({
    hasText: /You|Profile|أنت|الملف/i,
  })
  if (await tabProfile.count()) {
    await tabProfile.first().click({ force: true })
    await page.waitForTimeout(3500)
  } else {
    await page.goto(BASE + '/dashboard/profile', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    })
    await page.waitForTimeout(3500)
  }

  console.log(JSON.stringify({ url: page.url(), ...bag }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
