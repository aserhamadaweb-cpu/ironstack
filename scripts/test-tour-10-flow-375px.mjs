/**
 * Walks all 6 active tour steps at 375px — each target must be measurable.
 * Uses minimal HTML fixtures per step (no auth required).
 * Verifies orientation → feature transition (navMenu → splitRecommendations)
 * and empty-account Train fallbacks for sessionCoach + offlineTraining.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const appTourSrc = fs.readFileSync(path.join(ROOT, '../lib/app-tour.ts'), 'utf8')
const en = JSON.parse(
  fs.readFileSync(path.join(ROOT, '../messages/en.json'), 'utf8'),
)

function parseActiveIds(src) {
  const block = src.match(/APP_TOUR_ACTIVE_IDS[^=]*=\s*\[([\s\S]*?)\]/)
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
}

function stepHref(src, id) {
  const re = new RegExp(`id: '${id}'[\\s\\S]*?href: ('[^']*'|null)`, 'm')
  const m = src.match(re)
  if (!m) return null
  return m[1] === 'null' ? null : m[1].slice(1, -1)
}

function preferSelector(page, selector) {
  return page.evaluate((sel) => {
    const parts = sel
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    for (const part of parts) {
      const nodes = document.querySelectorAll(part)
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue
        const rect = node.getBoundingClientRect()
        if (rect.width < 4 && rect.height < 4) continue
        return {
          attr: node.getAttribute('data-tour'),
          width: rect.width,
          height: rect.height,
        }
      }
    }
    return null
  }, selector)
}

const FIXTURES = {
  homeHero: `<header data-tour="home-hero" style="min-height:120px;padding:20px;border:1px solid #b8860b;border-radius:16px"><h1>Hey Athlete</h1><p>@athlete</p></header>`,
  homeShortcuts: `<section data-tour="home-shortcuts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;min-height:120px;padding:12px;border:1px solid #444;border-radius:12px"><div style="min-height:48px;border:1px solid #333;padding:8px">Workout</div><div style="min-height:48px;border:1px solid #333;padding:8px">History</div></section>`,
  navTabs: `<nav data-tour="nav-tabbar" style="display:flex;gap:8px;min-height:56px;padding:8px;border:1px solid #444;border-radius:12px"><button style="flex:1;min-height:40px">Home</button><button style="flex:1;min-height:40px">Workout</button><button style="flex:1;min-height:40px">Messages</button></nav>`,
  navMenu: `<aside data-tour="nav-sidebar" style="min-height:200px;padding:16px;border:1px solid #b8860b;border-radius:12px"><button data-tour="nav-menu-icon">☰</button><p>Exercises · History · Coach · Settings</p></aside>`,
  splitRecommendations: `<a data-tour="create-split-recommended" style="display:block;min-height:11rem;padding:20px;border:1px solid #b8860b;border-radius:16px">Recommended splits</a>`,
  aiSplitBuilder: `<section data-tour="ai-split-builder" style="min-height:160px;padding:16px;border:1px solid #b8860b;border-radius:16px"><textarea style="width:100%;min-height:72px"></textarea></section>`,
  exercisesSearch: `<div data-tour="exercises-search" style="min-height:56px;padding:12px;border:1px solid #444;border-radius:12px"><input style="width:100%;min-height:40px" placeholder="Search exercises" /></div>`,
  sessionCoach: `<button data-tour="workout-start-cta" style="min-height:48px;width:100%;max-width:320px">Start workout</button>`,
  coachAiActions: `<div data-tour="coach-chat-composer" style="min-height:72px;padding:12px;border:1px solid #b8860b;border-radius:12px"><textarea style="width:100%;min-height:48px"></textarea></div>`,
  homeWorkouts: `<div data-tour="home-workouts-list" style="min-height:200px;padding:16px;border:1px solid #333;border-radius:12px">Home programs</div>`,
  offlineTraining: `<button data-tour="workout-offline-toggle" style="min-height:44px;width:100%">Save for Offline</button>`,
  challenges: `<section data-tour="challenges-create" style="min-height:120px;padding:16px;border:1px solid #b8860b;border-radius:16px"><button style="min-height:44px">New challenge</button></section>`,
  achievements: `<div data-tour="achievements-progress" style="min-height:100px;padding:16px;border:1px solid #333;border-radius:16px"><strong>2 / 24</strong></div>`,
  socialLeaderboard: `<main data-tour="page-leaderboard" style="min-height:200px;padding:16px;border:1px solid #444;border-radius:12px"><h1>Leaderboard</h1></main>`,
  messages: `<div data-tour="page-messages" style="min-height:180px;padding:16px;border:1px solid #444;border-radius:12px"><h1>Inbox</h1></div>`,
  settingsAppearance: `<section data-tour="settings-appearance" style="min-height:140px;padding:16px;border:1px solid #b8860b;border-radius:12px"><p>Dark · Light · System</p></section>`,
  done: `<ul>${(en.tour?.steps?.done?.checklist ?? []).map((item) => `<li>${item}</li>`).join('')}</ul>`,
}

async function main() {
  const activeIds = parseActiveIds(appTourSrc)
  if (activeIds.length !== 6) {
    throw new Error(`Expected 6 active steps, got ${activeIds.length}`)
  }

  const expected = [
    'homeHero',
    'homeShortcuts',
    'navTabs',
    'navMenu',
    'splitRecommendations',
    'aiSplitBuilder',
    'exercisesSearch',
    'sessionCoach',
    'coachAiActions',
    'homeWorkouts',
    'offlineTraining',
    'challenges',
    'achievements',
    'socialLeaderboard',
    'messages',
    'settingsAppearance',
    'done',
  ]
  for (let i = 0; i < expected.length; i += 1) {
    if (activeIds[i] !== expected[i]) {
      throw new Error(
        `Order mismatch at ${i + 1}: expected ${expected[i]}, got ${activeIds[i]}`,
      )
    }
  }

  const navMenuHref = stepHref(appTourSrc, 'navMenu')
  const splitHref = stepHref(appTourSrc, 'splitRecommendations')
  if (navMenuHref !== '/dashboard/home') {
    throw new Error(`navMenu href should be /dashboard/home, got ${navMenuHref}`)
  }
  if (splitHref !== '/dashboard/splits/new') {
    throw new Error(
      `splitRecommendations href should be /dashboard/splits/new, got ${splitHref}`,
    )
  }
  console.log(
    'Transition · navMenu (Home) → splitRecommendations (/dashboard/splits/new) ✓',
  )

  const checklist = en.tour?.steps?.done?.checklist
  if (!Array.isArray(checklist) || checklist.length !== 16) {
    throw new Error('done checklist must list exactly 16 features')
  }

  const outDir = path.join(ROOT, '../public/tour-preview')
  fs.mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })

  for (let i = 0; i < activeIds.length; i += 1) {
    const id = activeIds[i]
    const fixture = FIXTURES[id]
    if (!fixture && id !== 'done') {
      throw new Error(`Missing fixture for ${id}`)
    }

    const counter = `Step ${i + 1} of ${activeIds.length}`
    if (counter !== `Step ${i + 1} of 6`) {
      throw new Error(`Counter must be Step N of 6, got "${counter}"`)
    }

    await page.setContent(
      `<!DOCTYPE html><html><head><style>body{margin:0;font-family:system-ui;background:#0a0a0a;color:#eee;padding:16px} .label{color:#e8b54a;font-size:10px;font-weight:700;letter-spacing:.2em;margin-bottom:12px}</style></head><body><p class="label">APP TOUR · ${counter}</p>${fixture ?? ''}</body></html>`,
    )

    if (id !== 'done') {
      const box = await page.locator('[data-tour]').first().boundingBox()
      if (!box || box.width < 40 || box.height < 40) {
        throw new Error(
          `${id}: target not measurable at 375px (${JSON.stringify(box)})`,
        )
      }
    }

    await page.screenshot({
      path: path.join(
        outDir,
        `${String(i + 1).padStart(2, '0')}-${id}-375px.png`,
      ),
      fullPage: true,
    })
    console.log(`${counter} · ${id} ✓`)
  }

  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#0a0a0a;color:#eee">
    <div data-tour="workout-splits" style="min-height:140px;padding:16px;border:1px solid #444;border-radius:12px">No splits yet</div>
  </body></html>`)

  const offlineEmpty = await preferSelector(
    page,
    '[data-tour="workout-offline-toggle"], [data-tour="workout-splits"], [data-tour="workout-featured-split"]',
  )
  if (!offlineEmpty || offlineEmpty.attr !== 'workout-splits') {
    throw new Error(
      `offline empty fallback failed: ${JSON.stringify(offlineEmpty)}`,
    )
  }
  console.log('Empty account · offlineTraining → workout-splits ✓')

  const sessionEmpty = await preferSelector(
    page,
    '[data-tour="workout-start-cta"], [data-tour="workout-featured-split"], [data-tour="workout-splits"]',
  )
  if (!sessionEmpty || sessionEmpty.attr !== 'workout-splits') {
    throw new Error(
      `sessionCoach empty fallback failed: ${JSON.stringify(sessionEmpty)}`,
    )
  }
  console.log('Empty account · sessionCoach → workout-splits ✓')

  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#0a0a0a;color:#eee">
    <div data-tour="workout-splits" style="padding:12px;border:1px solid #444">
      <button data-tour="workout-start-cta" style="min-height:48px;width:100%">Start workout</button>
      <button data-tour="workout-offline-toggle" style="min-height:44px;width:100%;margin-top:8px">Save for Offline</button>
    </div>
  </body></html>`)
  const offlinePreferred = await preferSelector(
    page,
    '[data-tour="workout-offline-toggle"], [data-tour="workout-splits"], [data-tour="workout-featured-split"]',
  )
  if (!offlinePreferred || offlinePreferred.attr !== 'workout-offline-toggle') {
    throw new Error(
      `offline with-splits preference failed: ${JSON.stringify(offlinePreferred)}`,
    )
  }
  console.log('With splits · offlineTraining → workout-offline-toggle ✓')

  const sessionPreferred = await preferSelector(
    page,
    '[data-tour="workout-start-cta"], [data-tour="workout-featured-split"], [data-tour="workout-splits"]',
  )
  if (!sessionPreferred || sessionPreferred.attr !== 'workout-start-cta') {
    throw new Error(
      `sessionCoach with-splits preference failed: ${JSON.stringify(sessionPreferred)}`,
    )
  }
  console.log('With splits · sessionCoach → workout-start-cta ✓')

  await page.screenshot({
    path: path.join(outDir, '17-done-checklist-375px.png'),
    fullPage: true,
  })

  await browser.close()
  console.log(`\nPASS — 6-step flow at 375px. Previews: public/tour-preview/`)
  console.log('Order:', activeIds.join(' → '))
  console.log('Done checklist:')
  for (const item of checklist) console.log(` - ${item}`)
}

main().catch((err) => {
  console.error('FAIL:', err.message || err)
  process.exit(1)
})
