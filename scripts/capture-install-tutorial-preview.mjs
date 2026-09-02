import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.PREVIEW_BASE || 'http://localhost:3003'
const out = 'public/install-tutorial/_preview'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
await page.goto(`${BASE}/install-tutorial-preview`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: /tap the share button/i }).waitFor({
  timeout: 15000,
})
await page.screenshot({ path: `${out}/ios-step-1-375px.png`, fullPage: true })
await page.getByRole('button', { name: /next step/i }).click()
await page.getByRole('heading', { name: /add to home screen/i }).waitFor({
  timeout: 10000,
})
await page.screenshot({ path: `${out}/ios-step-2-375px.png`, fullPage: true })
await browser.close()
console.log(`Saved ${out}/ios-step-1-375px.png and ios-step-2-375px.png`)
