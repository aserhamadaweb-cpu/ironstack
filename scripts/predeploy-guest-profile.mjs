/**
 * Guest profile first-load stress (3 attempts).
 */
import { chromium } from 'playwright'

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  })
  let fails = 0

  for (let i = 0; i < 3; i++) {
    const page = await context.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))

    await page.goto(BASE + '/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(800)
    const eng = page.locator('button').filter({ hasText: /English/i }).first()
    if (await eng.isVisible().catch(() => false)) {
      await eng.click()
      await page.waitForTimeout(700)
    }
    await page.getByRole('button', { name: /guest/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 90000 })
    await page.waitForTimeout(1000)
    await page.goto(BASE + '/dashboard/profile', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(2500)
    const text = await page.locator('body').innerText()
    const good = /DAY STREAK|Edit profile|Athlete|CREATE ACCOUNT/i.test(text)
    const bad =
      !good && /couldn.?t load|Something went wrong/i.test(text)
    const r310 = errs.some((e) => /310|more hooks/i.test(e))
    const onDashboardProfile = page.url().includes('/dashboard/profile')
    console.log(
      'try',
      i + 1,
      'good',
      good,
      'badUI',
      bad,
      'r310',
      r310,
      'stayedOnDashboardProfile',
      onDashboardProfile,
      'url',
      page.url(),
    )
    if (bad || r310 || !good || !onDashboardProfile) fails++
    await page.close()
  }

  console.log('profile-stress fails', fails)
  await browser.close()
  if (fails) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
