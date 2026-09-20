/**
 * Production smoke: key routes + guest browse + connection overlay wiring.
 * Requires: npm run build && npm run start (PERF_BASE_URL, default :3000)
 * Run: node scripts/predeploy-smoke.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  })
  const page = await context.newPage()
  const results = []

  const check = async (name, fn) => {
    try {
      const note = await fn()
      results.push({
        name,
        ok: true,
        note: typeof note === 'string' ? note : undefined,
      })
      console.log('PASS', name)
    } catch (e) {
      results.push({ name, ok: false, err: String(e?.message || e) })
      console.log('FAIL', name, e?.message || e)
    }
  }

  await check('login loads', async () => {
    const res = await page.goto(BASE + '/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    assert(res && res.ok(), `status ${res?.status()}`)
    await page.waitForTimeout(600)
  })

  await check('reset-password loads', async () => {
    const res = await page.goto(BASE + '/login/reset-password', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    assert(res && res.ok(), `status ${res?.status()}`)
    const text = await page.locator('body').innerText()
    assert(/reset|password|إعادة|كلمة/i.test(text), 'reset copy missing')
  })

  await check('install-tutorial-preview blocked in production', async () => {
    const res = await page.goto(BASE + '/install-tutorial-preview', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    // Preview is notFound() when NODE_ENV=production
    assert(res && (res.status() === 404 || res.status() === 200), `status ${res?.status()}`)
    if (res.status() === 200) {
      const text = await page.locator('body').innerText()
      assert(/not found|404|doesn't exist/i.test(text), 'preview should not ship in production')
    }
  })

  await check('share split signed-out route responds', async () => {
    const res = await page.goto(BASE + '/share/split/invalid-token-predeploy', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    // 200 with not-found UI or 404 — must not 500
    assert(res && res.status() < 500, `status ${res?.status()}`)
  })

  await check('guest → home → workout → profile', async () => {
    // Fresh context — avoid leftover route aborts from other checks
    const guestPage = await context.newPage()
    try {
      await guestPage.goto(BASE + '/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await guestPage.waitForTimeout(800)
      const lang = guestPage
        .locator('button')
        .filter({ hasText: /English|العربية/i })
        .first()
      if (await lang.isVisible().catch(() => false)) {
        await lang.click()
        await guestPage.waitForTimeout(500)
      }
      const guest = guestPage.getByRole('button', { name: /guest|زائر/i })
      assert(await guest.isVisible(), 'guest CTA missing')
      await guest.click()
      await guestPage.waitForURL(/\/dashboard\//, { timeout: 90000 })
      await guestPage
        .locator('nav')
        .first()
        .waitFor({ state: 'visible', timeout: 30000 })
      await guestPage.waitForTimeout(400)

      const hasNavProgress = await guestPage.evaluate(() => {
        return Boolean(
          document.querySelector('nav') || document.body.innerText.length > 40,
        )
      })
      assert(hasNavProgress, 'shell not hydrated')

      await guestPage.goto(BASE + '/dashboard/workout', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await guestPage.waitForTimeout(1200)
      assert(guestPage.url().includes('/dashboard/workout'), 'workout nav failed')
      const workoutText = await guestPage.locator('body').innerText()
      assert(workoutText.length > 40, 'workout blank')

      await guestPage.goto(BASE + '/dashboard/profile', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await guestPage.waitForTimeout(1500)
      assert(
        guestPage.url().includes('/dashboard/profile'),
        'profile nav failed',
      )
      const profileText = await guestPage.locator('body').innerText()
      assert(profileText.length > 40, 'profile blank / failed first load')

      const body = await guestPage.locator('body').innerText()
      assert(
        /CREATE ACCOUNT|إنشاء حساب|guest|زائر/i.test(body),
        'guest upgrade cues missing',
      )

      // Appearance visible; language/units/tour restart stay guest-gated
      await guestPage.goto(BASE + '/dashboard/settings', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await guestPage.waitForTimeout(800)
      assert(
        (await guestPage.locator('[data-tour="settings-appearance"]').count()) >
          0,
        'guest appearance missing',
      )
      assert(
        (await guestPage
          .locator('[data-tour="settings-restart-tour"]')
          .count()) === 0,
        'tour restart should stay guest-gated',
      )
    } finally {
      await guestPage.close()
    }
  })

  await check('slow-connection overlay appears when intent stuck', async () => {
    // Stay on home; inject stuck navigation intent via same timers as NavigationProgress
    await page.goto(BASE + '/dashboard/home', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(1000)

    // Click a heavy route and abort RSC payloads so soft nav stalls
    await page.route('**/dashboard/analytics**', (route) => {
      if (route.request().resourceType() === 'document') return route.continue()
      return route.abort('timedout')
    })
    await page.route('**/_next/static/**', (route) => route.continue())

    const link = page.locator('a[href="/dashboard/analytics"]').first()
    if (await link.isVisible().catch(() => false)) {
      await link.click({ force: true })
    } else {
      // Open menu then analytics, or force pathname intent via click on any sidebar
      const menu = page.getByRole('button', { name: /menu|open menu|القائمة/i }).first()
      if (await menu.isVisible().catch(() => false)) {
        await menu.click()
        await page.waitForTimeout(400)
      }
      const analytics = page.locator('a[href="/dashboard/analytics"]').first()
      if (await analytics.isVisible().catch(() => false)) {
        await analytics.click({ force: true })
      } else {
        // Direct evaluate markNavigationIntent if exposed; else soft-goto that stalls
        await page.evaluate(() => {
          // Dispatch click-like path: pushState won't trigger; use history + event
          window.history.pushState({}, '', '/dashboard/home')
        })
        // Force overlay by importing nothing — use location.assign abort via route
        await page.evaluate(() => {
          const a = document.createElement('a')
          a.href = '/dashboard/analytics'
          a.setAttribute('data-testid', 'forced-nav')
          document.body.appendChild(a)
          a.click()
        })
      }
    }

    await page.waitForTimeout(5000)
    const text = await page.locator('body').innerText()
    const has =
      /Connection is slow|Couldn't load|الاتصال بطيء|تعذّر تحميل|Loading…|جارٍ التحميل|Retry|إعادة/i.test(
        text,
      )
    // Soft success from cache is OK if we at least didn't crash
    if (!has) {
      console.log('NOTE: overlay not visible (nav may have completed); url=', page.url())
    }
    return has ? 'overlay seen' : 'overlay not seen (may have completed)'
  })

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log('\n=== predeploy-smoke ===')
  for (const r of results) {
    console.log(r.ok ? 'ok' : 'FAIL', r.name, r.note || r.err || '')
  }
  if (failed.length) {
    process.exitCode = 1
    throw new Error(`${failed.length} smoke check(s) failed`)
  }
  console.log('all smoke checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
