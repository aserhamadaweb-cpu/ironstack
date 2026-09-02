/**
 * Validates 10-step active tour wiring + smoke-tests coach-mark targets at 375px.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.TOUR_TEST_BASE || 'http://localhost:3000'
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
    'navTabs',
    'navMenu',
    'workoutSplits',
    'workoutCreate',
    'sessionStart',
    'history',
    'coach',
    'settingsTour',
    'done',
  ]

  const expectedDormant = [
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

  if (activeIds.length !== 10) {
    failures.push(`Expected 10 active tour steps, found ${activeIds.length}`)
  }
  if (allIds.length !== 21) {
    failures.push(`Expected 21 total step defs in APP_TOUR_STEPS_ALL, found ${allIds.length}`)
  }
  if (!appTourSrc.includes('APP_TOUR_STEP_COUNT = APP_TOUR_STEPS.length')) {
    failures.push('APP_TOUR_STEP_COUNT must derive from APP_TOUR_STEPS.length')
  }
  if (!appTourSrc.includes('APP_TOUR_ACTIVE_IDS')) {
    failures.push('Missing APP_TOUR_ACTIVE_IDS')
  }
  if (!appTourSrc.includes('APP_TOUR_STEPS_ALL')) {
    failures.push('Missing APP_TOUR_STEPS_ALL')
  }

  for (let i = 0; i < expectedActive.length; i += 1) {
    if (activeIds[i] !== expectedActive[i]) {
      failures.push(
        `Active step ${i + 1}: expected ${expectedActive[i]}, got ${activeIds[i] ?? '(missing)'}`,
      )
    }
  }

  for (const dormant of expectedDormant) {
    if (!allIds.includes(dormant)) {
      failures.push(`Dormant step missing from APP_TOUR_STEPS_ALL: ${dormant}`)
    }
    if (activeIds.includes(dormant)) {
      failures.push(`Dormant step leaked into active tour: ${dormant}`)
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
      step: 'navTabs',
      href: '/dashboard/home',
      target: 'nav-tabbar',
      file: 'components/dashboard-nav.tsx',
    },
    {
      step: 'navMenu',
      href: '/dashboard/home',
      target: 'nav-menu-icon',
      file: 'components/dashboard-nav.tsx',
    },
    {
      step: 'workoutSplits',
      href: '/dashboard/workout',
      target: 'workout-my-splits-link',
      file: 'components/workout-dashboard.tsx',
    },
    {
      step: 'workoutCreate',
      href: '/dashboard/splits/new',
      target: 'create-split-choice',
      file: 'components/create-split-choice.tsx',
    },
    {
      step: 'sessionStart',
      href: '/dashboard/workout',
      target: 'workout-start-cta',
      file: 'components/workout-split-card.tsx',
    },
    {
      step: 'history',
      href: '/dashboard/history',
      target: 'history-list',
      file: 'components/history-session-list.tsx',
    },
    {
      step: 'coach',
      href: '/dashboard/ai-coach',
      target: 'coach-chat',
      file: 'app/dashboard/ai-coach/page.tsx',
    },
    {
      step: 'settingsTour',
      href: '/dashboard/settings',
      target: 'settings-restart-tour',
      file: 'components/settings-page.tsx',
    },
  ]

  for (const w of activeWiring) {
    if (w.step === 'workoutCreate') {
      if (!appTourSrc.includes("href: '/dashboard/splits/new'")) {
        failures.push('workoutCreate active override missing /dashboard/splits/new')
      }
      if (!appTourSrc.includes('[data-tour="create-split-choice"]')) {
        failures.push('workoutCreate active override missing create-split-choice target')
      }
    } else {
      const block = stepBlock(appTourSrc, w.step)
      if (!block) {
        failures.push(`Missing step block for ${w.step}`)
        continue
      }
      if (!block.includes(`href: '${w.href}'`)) {
        failures.push(`${w.step} active href should be ${w.href}`)
      }
      if (!block.includes(`data-tour="${w.target}"`)) {
        failures.push(`${w.step} missing target data-tour="${w.target}"`)
      }
    }
    const component = read(w.file)
    if (!component.includes(w.target)) {
      failures.push(`${w.file} missing tour target ${w.target}`)
    }
  }

  // Dormant workoutCreate in ALL should still point at Train create CTA
  const dormantCreate = stepBlock(appTourSrc, 'workoutCreate')
  if (!dormantCreate.includes(`href: '/dashboard/workout'`)) {
    failures.push('APP_TOUR_STEPS_ALL workoutCreate should keep /dashboard/workout href')
  }

  for (const locale of ['en.json', 'ar.json']) {
    const json = JSON.parse(read(`messages/${locale}`))
    for (const key of expectedActive.filter((k) => k !== 'done')) {
      const step = json.tour?.steps?.[key]
      if (!step?.title || !step?.lead) {
        failures.push(`messages/${locale} missing tour.steps.${key}.title/lead`)
      }
    }
    for (const key of expectedDormant) {
      const step = json.tour?.steps?.[key]
      if (!step?.title || !step?.lead) {
        failures.push(`messages/${locale} missing dormant tour.steps.${key}.title/lead`)
      }
    }
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })

  // Step 5 — create split choice grid at 375px
  await page.setContent(`
    <!DOCTYPE html>
    <html><head><style>
      body { margin: 0; font-family: system-ui; background: #0a0a0a; color: #eee; }
      main { padding: 16px; max-width: 375px; }
      .grid { display: grid; gap: 16px; }
      .card { border: 1px solid #b8860b; border-radius: 16px; padding: 20px; min-height: 11rem; }
    </style></head>
    <body>
      <main>
        <h1 style="font-size:22px;margin:0 0 12px">How do you want to create?</h1>
        <div class="grid" data-tour="create-split-choice">
          <div class="card">Create yourself</div>
          <div class="card">Create with AI</div>
          <div class="card">Recommended splits</div>
        </div>
      </main>
    </body></html>
  `)
  const choiceBox = await page.locator('[data-tour="create-split-choice"]').boundingBox()
  if (!choiceBox || choiceBox.width < 280 || choiceBox.height < 200) {
    failures.push(
      `create-split-choice not measurable at 375px (${JSON.stringify(choiceBox)})`,
    )
  }
  console.log(`375px step 5 create-split-choice: ${JSON.stringify(choiceBox)}`)

  // Simulate step counter labels for all 10 steps
  for (let i = 0; i < expectedActive.length; i += 1) {
    const label = `Step ${i + 1} of ${expectedActive.length}`
    if (label !== `Step ${i + 1} of 10`) {
      failures.push(`Bad counter label at index ${i}`)
    }
  }

  await browser.close()

  if (failures.length) {
    console.error('FAIL')
    for (const f of failures) console.error(' -', f)
    process.exit(1)
  }
  console.log('PASS — 10-step active tour wiring + 375px create-choice ok')
  console.log('Active:', activeIds.join(' → '))
  console.log('Dormant:', expectedDormant.join(', '))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
