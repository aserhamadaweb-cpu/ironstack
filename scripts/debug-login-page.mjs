import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:3002/login', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
console.log('URL:', page.url())
const buttons = await page.locator('button, a').allTextContents()
console.log('Clickables:', buttons.filter(Boolean).slice(0, 20))
await page.getByText('English', { exact: false }).first().click()
await page.waitForTimeout(3000)
console.log('After click URL:', page.url())
console.log('Has email:', await page.locator('#email').count())
await browser.close()
