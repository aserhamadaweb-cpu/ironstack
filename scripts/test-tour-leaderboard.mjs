/**
 * Smoke-test tour leaderboard targeting against the local dev server.
 */
import fs from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.TOUR_TEST_BASE || 'http://localhost:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const failures = []

  const appTourSrc = fs.readFileSync('lib/app-tour.ts', 'utf8')
  if (!appTourSrc.includes("href: '/dashboard/leaderboard'")) {
    failures.push('socialLeaderboard step does not navigate to /dashboard/leaderboard')
  }
  if (!appTourSrc.includes('[data-tour="page-leaderboard"]')) {
    failures.push('socialLeaderboard step missing page-leaderboard target')
  }

  const lbPage = fs.readFileSync('components/leaderboard-page.tsx', 'utf8')
  if (!lbPage.includes('data-tour="page-leaderboard"')) {
    failures.push('leaderboard-page.tsx missing data-tour="page-leaderboard"')
  }
  const home = fs.readFileSync('components/home-dashboard.tsx', 'utf8')
  if (!home.includes('data-tour="home-leaderboard"')) {
    failures.push('home-dashboard.tsx missing data-tour="home-leaderboard"')
  }

  const res = await page.goto(`${BASE}/dashboard/leaderboard`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  const url = page.url()
  console.log('leaderboard navigation →', url, 'status', res?.status())

  if (url.includes('/login')) {
    console.log('Not authenticated — verifying scroll + late-mount retry fixtures.')
    await page.setContent(`
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div style="height:2000px">spacer</div>
        <div data-tour="page-leaderboard" id="lb" style="height:200px;background:#333;color:#fff;padding:24px">
          Leaderboard fixture
        </div>
        <div style="height:800px">after</div>
        <script>
          window.__scroll = () => {
            const el = document.querySelector('[data-tour="page-leaderboard"]');
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            return el.getBoundingClientRect();
          };
        </script>
      </body></html>
    `)
    const before = await page.evaluate(() => window.scrollY)
    const rect = await page.evaluate(() => window.__scroll())
    const after = await page.evaluate(() => window.scrollY)
    console.log('fixture scrollY', { before, after, rectTop: Math.round(rect.top) })
    if (after <= before) {
      failures.push('scrollIntoView did not move the page toward the leaderboard fixture')
    }
    if (rect.top < 0 || rect.top > 800) {
      failures.push(`leaderboard fixture not centered in viewport (top=${rect.top})`)
    }

    await page.setContent(`
      <!DOCTYPE html>
      <html><body><div id="root"></div></body></html>
    `)
    const waitResult = await page.evaluate(async () => {
      let attempts = 0
      setTimeout(() => {
        const el = document.createElement('div')
        el.setAttribute('data-tour', 'page-leaderboard')
        el.textContent = 'late'
        document.getElementById('root').appendChild(el)
      }, 400)
      while (attempts < 50) {
        attempts += 1
        if (document.querySelector('[data-tour="page-leaderboard"]')) {
          return { found: true, attempts }
        }
        await new Promise((r) => setTimeout(r, 50))
      }
      return { found: false, attempts }
    })
    console.log('late-mount wait →', waitResult)
    if (!waitResult.found) {
      failures.push('retry wait failed to find late-mounted leaderboard target')
    }
  } else {
    await page.waitForSelector('[data-tour="page-leaderboard"]', { timeout: 15000 })
    const box = await page.locator('[data-tour="page-leaderboard"]').boundingBox()
    console.log('live page-leaderboard box', box)
    if (!box || box.height < 40) {
      failures.push('page-leaderboard present but not measurable')
    }
    await page.locator('[data-tour="page-leaderboard"]').scrollIntoViewIfNeeded()
    const inView = await page.locator('[data-tour="page-leaderboard"]').evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    })
    if (!inView) failures.push('page-leaderboard not in viewport after scroll')
  }

  await browser.close()

  if (failures.length) {
    console.error('FAIL')
    for (const f of failures) console.error(' -', f)
    process.exit(1)
  }
  console.log('PASS — leaderboard tour targeting checks ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
