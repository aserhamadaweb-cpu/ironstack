/**
 * Capture install tutorial previews at 375px.
 * Usage: PREVIEW_BASE=http://127.0.0.1:3010 node scripts/capture-install-tutorial-preview.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.PREVIEW_BASE || 'http://127.0.0.1:3010'
const out = join(ROOT, '../public/install-tutorial/_preview')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })

async function capturePlatform(platform) {
  await page.goto(`${BASE}/install-tutorial-preview?platform=${platform}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForSelector(`[data-install-tutorial="${platform}"]`, {
    timeout: 15000,
  })
  const layout = await page.getAttribute(
    `[data-install-tutorial="${platform}"]`,
    'data-install-layout',
  )
  const bodyText = await page.locator('body').innerText()
  if (/coming soon|screenshot coming/i.test(bodyText)) {
    throw new Error(`${platform}: still shows placeholder copy`)
  }
  if (platform !== 'ios' && layout !== 'text') {
    throw new Error(`${platform}: expected data-install-layout=text, got ${layout}`)
  }
  if (platform === 'ios' && layout !== 'image') {
    throw new Error(`ios: expected data-install-layout=image, got ${layout}`)
  }

  const imgCount = await page.locator('img').count()
  if (platform !== 'ios' && imgCount > 0) {
    throw new Error(`${platform}: unexpected <img> count ${imgCount}`)
  }

  await page.screenshot({
    path: join(out, `${platform}-step-1-375px.png`),
    fullPage: true,
  })
  const next = page.getByRole('button', { name: /next step/i })
  if (await next.isEnabled()) {
    await next.click()
    await page.waitForTimeout(250)
    await page.screenshot({
      path: join(out, `${platform}-step-2-375px.png`),
      fullPage: true,
    })
  }
  console.log(`OK ${platform} layout=${layout} imgs=${imgCount}`)
}

await capturePlatform('android')
await capturePlatform('ios')
await browser.close()
console.log(`Saved under ${out}`)
