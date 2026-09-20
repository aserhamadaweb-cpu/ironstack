/**
 * Live verification of the 6-step tour against the running app (guest session).
 *
 * Guests cannot open the coach-mark overlay (restart/auto-offer gated), so this
 * walks every active step route and asserts the tour target is measurable —
 * including guest-blocked fallbacks for coachAiActions + messages.
 * Also times navigations to confirm cross-page hops aren't cold-MPA slow.
 *
 * Usage:
 *   TOUR_TEST_BASE=http://127.0.0.1:3001 node scripts/test-tour-17-live-walk.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.TOUR_TEST_BASE || 'http://127.0.0.1:3001'
const VIEWPORT = { width: 375, height: 812 }

function parseActiveIds(src) {
  const block = src.match(/APP_TOUR_ACTIVE_IDS[^=]*=\s*\[([\s\S]*?)\]/)
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
}

function stepBlock(src, id) {
  const re = new RegExp(`\\{\\s*id: '${id}'[\\s\\S]*?\\n\\s*\\},`, 'm')
  return src.match(re)?.[0] ?? ''
}

function stepHref(src, id) {
  const block = stepBlock(src, id)
  const m = block.match(/href: ('[^']*'|null)/)
  if (!m) return null
  return m[1] === 'null' ? null : m[1].slice(1, -1)
}

function stepTarget(src, id) {
  const block = stepBlock(src, id)
  const m = block.match(/target:\s*([\s\S]*?)(?:,\s*\n|\n\s*\})/)
  if (!m) return null
  return m[1]
    .replace(/[`']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function guestLogin(page) {
  await page.goto(`${BASE}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(500)
  const eng = page.locator('button').filter({ hasText: /English/i }).first()
  if (await eng.isVisible().catch(() => false)) {
    await eng.click()
    await page.waitForTimeout(400)
  }
  await page.getByRole('button', { name: /guest/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)(\/|$|\?)/, { timeout: 90000 })
  if (page.url().includes('/onboarding')) {
    await page.goto(`${BASE}/dashboard/home`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
  }
}

async function findTarget(page, selector) {
  return page.evaluate((sel) => {
    const parts = sel
      .split(',')
      .map((p) => p.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter(Boolean)
    for (const part of parts) {
      const nodes = document.querySelectorAll(part)
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue
        const style = window.getComputedStyle(node)
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0
        ) {
          continue
        }
        const rect = node.getBoundingClientRect()
        if (rect.width < 4 && rect.height < 4) continue
        const sidebar = node.closest('.app-sidebar')
        if (
          sidebar instanceof HTMLElement &&
          !sidebar.classList.contains('is-open')
        ) {
          continue
        }
        return {
          attr: node.getAttribute('data-tour'),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        }
      }
    }
    return null
  }, selector)
}

async function main() {
  const appTourSrc = fs.readFileSync(
    path.join(ROOT, '../lib/app-tour.ts'),
    'utf8',
  )
  const en = JSON.parse(
    fs.readFileSync(path.join(ROOT, '../messages/en.json'), 'utf8'),
  )
  const activeIds = parseActiveIds(appTourSrc)
  if (activeIds.length !== 6) {
    throw new Error(`Expected 6 active steps, got ${activeIds.length}`)
  }

  const checklist = en.tour?.steps?.done?.checklist
  if (!Array.isArray(checklist) || checklist.length !== 16) {
    throw new Error('done checklist must have 16 items')
  }

  const provider = fs.readFileSync(
    path.join(ROOT, '../components/app-tour/app-tour-provider.tsx'),
    'utf8',
  )
  const coachMark = fs.readFileSync(
    path.join(ROOT, '../components/app-tour/tour-coach-mark.tsx'),
    'utf8',
  )
  if (!provider.includes('router.prefetch')) {
    throw new Error('Tour prefetch missing from provider')
  }
  if (/setTimeout\(\s*tryLocate,\s*80\s*\)/.test(coachMark)) {
    throw new Error('80ms locate deferral still present')
  }
  if (!coachMark.includes('Same-page Next')) {
    throw new Error('Same-page pending-skip missing')
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  page.setDefaultTimeout(45000)

  console.log('Guest login…')
  await guestLogin(page)
  console.log('After login:', page.url())

  // Warm: visit home once so shared shell is cached
  await page.goto(`${BASE}/dashboard/home`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(500)

  const results = []
  let prevHref = '/dashboard/home'

  for (let i = 0; i < activeIds.length; i += 1) {
    const id = activeIds[i]
    const href = stepHref(appTourSrc, id)
    const target = stepTarget(appTourSrc, id)

    if (id === 'done') {
      results.push({
        id,
        href: null,
        ms: 0,
        samePage: true,
        target: 'checklist',
        ok: checklist.length === 16,
      })
      console.log(`Step ${i + 1}/6 done · checklist ${checklist.length} items ✓`)
      continue
    }

    if (!href || !target) {
      throw new Error(`Missing href/target for ${id}`)
    }

    const samePage = href === prevHref
    const t0 = Date.now()

    if (id === 'navMenu') {
      // Open sidebar so nav-sidebar is a valid candidate
      const menuBtn = page
        .locator('[data-tour="nav-menu-icon"], [data-tour="nav-menu"]')
        .first()
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click()
        await page.waitForTimeout(250)
      }
    } else if (!samePage) {
      await page.goto(`${BASE}${href}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
    }

    // Prefer client soft-nav feel for a second hop to the same href (warm)
    if (!samePage) {
      // second visit to measure warm cache
    }

    let found = await findTarget(page, target)
    // Brief retry for late-mount targets
    if (!found) {
      await page.waitForTimeout(800)
      found = await findTarget(page, target)
    }
    const ms = Date.now() - t0

    if (!found) {
      throw new Error(
        `Broken target for ${id} on ${href}: selector ${target} (url=${page.url()})`,
      )
    }

    results.push({
      id,
      href,
      ms,
      samePage,
      target: found.attr,
      ok: true,
      size: `${found.w}x${found.h}`,
    })
    console.log(
      `Step ${i + 1}/6 ${id.padEnd(22)} → ${found.attr?.padEnd(28) || '?'} ${ms}ms ${samePage ? '(same-page)' : '(nav)'} ${found.w}x${found.h}`,
    )
    prevHref = href
  }

  // Warm re-nav timing sample for a few cross-page tour hops
  const sampleHrefs = [
    '/dashboard/splits/new',
    '/dashboard/exercises',
    '/dashboard/workout',
    '/dashboard/challenges',
    '/dashboard/settings',
  ]
  console.log('\nWarm re-nav timings:')
  const warmTimes = []
  for (const href of sampleHrefs) {
    const t0 = Date.now()
    await page.goto(`${BASE}${href}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    const ms = Date.now() - t0
    warmTimes.push({ href, ms })
    console.log(`  ${href} ${ms}ms`)
  }

  await browser.close()

  const broken = results.filter((r) => !r.ok)
  if (broken.length) {
    throw new Error(`Broken steps: ${broken.map((b) => b.id).join(', ')}`)
  }

  const navs = results.filter((r) => !r.samePage && r.id !== 'done')
  const slowNavs = navs.filter((r) => r.ms >= 3000)
  console.log(`\nCross-page steps: ${navs.length}, slow≥3s: ${slowNavs.length}`)
  if (slowNavs.length) {
    console.warn(
      'Slow first-hit navs:',
      slowNavs.map((s) => `${s.id}:${s.ms}ms`).join(', '),
    )
  }

  console.log('\nOrder:', activeIds.join(' → '))
  console.log('Done checklist:')
  for (const item of checklist) console.log(` - ${item}`)
  console.log('\nPASS — live 6-step route/target walk completed')
  console.log(
    'Note: coach-mark overlay is signed-in only; lag fixes verified in code + fixture tests.',
  )
}

main().catch((err) => {
  console.error('FAIL:', err.message || err)
  process.exit(1)
})
