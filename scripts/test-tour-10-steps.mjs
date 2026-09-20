/**
 * Validates 8-step active tour wiring (home → train → AI → offline → session → tabs → done).
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const ROOT = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function parseActiveTourIds(src) {
  const block = src.match(
    /export const APP_TOUR_ACTIVE_IDS[^=]*=\s*\[([\s\S]*?)\]/,
  )
  if (!block) return []
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
}

function parseAllTourIds(src) {
  return [...src.matchAll(/id: '([a-zA-Z]+)'/g)].map((m) => m[1])
}

function stepBlock(src, id) {
  const re = new RegExp(`id: '${id}'[\\s\\S]*?\\},`, 'm')
  return src.match(re)?.[0] ?? ''
}

async function main() {
  const failures = []
  const appTourSrc = read('lib/app-tour.ts')
  const activeIds = parseActiveTourIds(appTourSrc)
  const allIds = parseAllTourIds(appTourSrc)

  const expectedActive = [
    'homeHero',
    'homeTrainCta',
    'workoutCreate',
    'coach',
    'offlineMode',
    'sessionStart',
    'navTabs',
    'done',
  ]

  if (activeIds.length !== expectedActive.length) {
    failures.push(
      `Expected ${expectedActive.length} active tour steps, found ${activeIds.length}`,
    )
  }
  if (allIds.length !== 27) {
    failures.push(
      `Expected 27 total step defs in APP_TOUR_STEPS_ALL, found ${allIds.length}`,
    )
  }
  if (!appTourSrc.includes('APP_TOUR_STEP_COUNT = APP_TOUR_STEPS.length')) {
    failures.push('APP_TOUR_STEP_COUNT must derive from APP_TOUR_STEPS.length')
  }

  for (let i = 0; i < expectedActive.length; i += 1) {
    if (activeIds[i] !== expectedActive[i]) {
      failures.push(
        `Active step ${i + 1}: expected ${expectedActive[i]}, got ${activeIds[i] ?? '(missing)'}`,
      )
    }
  }

  const activeWiring = [
    {
      step: 'homeHero',
      href: '/dashboard/home',
      target: 'home-hero',
      file: 'components/home-dashboard.tsx',
    },
    {
      step: 'homeTrainCta',
      href: '/dashboard/home',
      target: 'home-train-cta',
      file: 'components/home-dashboard.tsx',
    },
    {
      step: 'workoutCreate',
      href: '/dashboard/workout',
      target: 'workout-create-cta',
      file: 'components/workout-dashboard.tsx',
      alsoInBlock: ['workout-create'],
    },
    {
      step: 'coach',
      href: '/dashboard/ai-coach',
      target: 'coach-chat',
      file: 'app/dashboard/ai-coach/page.tsx',
    },
    {
      step: 'offlineMode',
      href: '/dashboard/settings',
      target: 'settings-offline',
      file: 'components/settings-page.tsx',
    },
    {
      step: 'sessionStart',
      href: '/dashboard/workout',
      target: 'workout-start-cta',
      file: 'components/workout-split-card.tsx',
      alsoInBlock: ['workout-featured-split', 'workout-splits'],
    },
    {
      step: 'navTabs',
      href: '/dashboard/home',
      target: 'nav-tabbar',
      file: 'components/dashboard-nav.tsx',
    },
  ]

  for (const row of activeWiring) {
    if (!activeIds.includes(row.step)) {
      failures.push(`Active wiring references missing step: ${row.step}`)
      continue
    }
    const block = stepBlock(appTourSrc, row.step)
    if (!block.includes(row.href)) {
      failures.push(`${row.step}: expected href ${row.href}`)
    }
    if (!block.includes(row.target)) {
      failures.push(
        `${row.step}: expected target selector containing ${row.target}`,
      )
    }
    const fileSrc = read(row.file)
    if (!fileSrc.includes(`data-tour="${row.target}"`)) {
      const alts = row.alsoInBlock ?? []
      const okAlt = alts.some((alt) => fileSrc.includes(`data-tour="${alt}"`))
      if (!okAlt) {
        failures.push(
          `${row.step}: ${row.file} missing data-tour="${row.target}"`,
        )
      }
    }
  }

  const en = JSON.parse(read('messages/tour.en.json'))
  const ar = JSON.parse(read('messages/tour.ar.json'))
  for (const id of expectedActive) {
    if (!en.steps?.[id]?.title) {
      failures.push(`tour.en.json missing steps.${id}.title`)
    }
    if (!ar.steps?.[id]?.title) {
      failures.push(`tour.ar.json missing steps.${id}.title`)
    }
  }

  if (failures.length) {
    console.error('FAIL')
    for (const f of failures) console.error(' -', f)
    process.exit(1)
  }

  console.log(`PASS — active tour wiring (${expectedActive.length} steps)`)
  console.log(expectedActive.join(' → '))

  const base = process.env.TOUR_BASE_URL || process.env.BASE_URL
  if (!base) {
    console.log('Skip browser smoke (set TOUR_BASE_URL to enable)')
    return
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log('Browser smoke: landed on', page.url())
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
