/**
 * Walks all 10 active tour steps at 375px — each target must be measurable.
 * Uses minimal HTML fixtures per step (no auth required).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const appTourSrc = fs.readFileSync(path.join(ROOT, '../lib/app-tour.ts'), 'utf8')

function parseActiveIds(src) {
  const block = src.match(/APP_TOUR_ACTIVE_IDS[^=]*=\s*\[([\s\S]*?)\]/)
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
}

const FIXTURES = {
  homeHero: `<div data-tour="home-hero" style="min-height:120px;padding:16px;border:1px solid #b8860b;border-radius:12px">Home hero</div>`,
  navTabs: `<nav data-tour="nav-tabbar" style="display:flex;gap:8px;padding:12px"><button style="min-height:44px;flex:1">Home</button><button style="min-height:44px;flex:1">Train</button></nav>`,
  navMenu: `<button data-tour="nav-menu-icon" style="min-width:44px;min-height:44px">☰</button>`,
  workoutSplits: `<a data-tour="workout-my-splits-link" style="display:inline-flex;min-height:44px;padding:0 16px;align-items:center">My splits</a>`,
  workoutCreate: `<div data-tour="create-split-choice" style="display:grid;gap:12px;padding:16px"><div style="min-height:11rem;border:1px solid #b8860b;border-radius:16px;padding:16px">Manual</div><div style="min-height:11rem;border:1px solid #b8860b;border-radius:16px;padding:16px">AI</div><div style="min-height:11rem;border:1px solid #b8860b;border-radius:16px;padding:16px">Recommended</div></div>`,
  sessionStart: `<button data-tour="workout-start-cta" style="min-height:48px;width:100%;max-width:320px">Start workout</button>`,
  history: `<div data-tour="history-list" style="min-height:200px;padding:16px;border:1px solid #333;border-radius:12px">History list</div>`,
  coach: `<div data-tour="coach-chat" style="min-height:160px;padding:16px;border:1px solid #b8860b;border-radius:12px">AI Coach</div>`,
  settingsTour: `<section data-tour="settings-restart-tour" style="min-height:100px;padding:16px;border:1px solid #333;border-radius:12px">Restart tour</section>`,
  done: `<p>Tour complete</p>`,
}

async function main() {
  const activeIds = parseActiveIds(appTourSrc)
  if (activeIds.length !== 10) {
    throw new Error(`Expected 10 active steps, got ${activeIds.length}`)
  }

  const dormant = [
    'homeShortcuts',
    'splitRecommendations',
    'exercisesSearch',
    'exercisesGrid',
    'homeWorkouts',
    'coachAiActions',
    'settingsAppearance',
    'offlineMode',
    'socialLeaderboard',
    'socialCircle',
    'messages',
  ]
  for (const id of dormant) {
    if (activeIds.includes(id)) {
      throw new Error(`Dormant step leaked into active flow: ${id}`)
    }
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
    await page.setContent(`<!DOCTYPE html><html><head><style>body{margin:0;font-family:system-ui;background:#0a0a0a;color:#eee;padding:16px} .label{color:#e8b54a;font-size:10px;font-weight:700;letter-spacing:.2em;margin-bottom:12px}</style></head><body><p class="label">APP TOUR · ${counter}</p>${fixture ?? ''}</body></html>`)

    if (id !== 'done') {
      const selector = `[data-tour]`
      const box = await page.locator(selector).first().boundingBox()
      if (!box || box.width < 40 || box.height < 40) {
        throw new Error(`${id}: target not measurable at 375px (${JSON.stringify(box)})`)
      }
    }

    await page.screenshot({
      path: path.join(outDir, `${String(i + 1).padStart(2, '0')}-${id}-375px.png`),
      fullPage: true,
    })
    console.log(`${counter} · ${id} ✓`)
  }

  await browser.close()
  console.log(`\nPASS — 10-step flow at 375px. Previews: public/tour-preview/`)
}

main().catch((err) => {
  console.error('FAIL:', err.message || err)
  process.exit(1)
})
