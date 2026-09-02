/**
 * Verifies onboarding completes at step 8 (review) → app tour, with no
 * split-recommendations step in between. Also confirms Create Split still
 * links to /dashboard/splits/recommendations.
 *
 *   node scripts/verify-onboarding-no-recommendations-step.mjs
 *
 * Optional: TOUR_TEST_BASE=http://localhost:3002 (use a server running the latest build)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.TOUR_TEST_BASE || 'http://localhost:3000'

function loadEnv() {
  return Object.fromEntries(
    readFileSync(join(root, '.env.local'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      }),
  )
}

function staticChecks() {
  const flow = readFileSync(join(root, 'components/onboarding-flow.tsx'), 'utf8')
  const choice = readFileSync(join(root, 'components/create-split-choice.tsx'), 'utf8')
  const types = readFileSync(join(root, 'lib/onboarding-types.ts'), 'utf8')
  const fails = []

  if (
    /step === 9|SplitRecommendationsPanel|finishOnboardingFromRecommendations|continueToRecommendations|recommendationsNextHint/.test(
      flow,
    )
  ) {
    fails.push('onboarding-flow still references step 9 / recommendations')
  }
  if (!flow.includes('void finishOnboarding(homeAfterOnboarding)')) {
    fails.push('step 8 must call finishOnboarding directly')
  }
  if (!choice.includes('RECOMMENDED_SPLITS_PATH')) {
    fails.push('create-split-choice missing recommendations path')
  }
  if (!types.includes('Math.min(8,')) {
    fails.push('clampOnboardingStep max should be 8')
  }
  if (fails.length) throw new Error(fails.join('; '))
}

async function clickContinue(page) {
  await page.getByRole('button', { name: /^continue$|^create my plan$|^save changes$/i }).click()
}

async function e2eFreshSignup(env) {
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const stamp = Date.now()
  const email = `onboard-verify-${stamp}@ironstack-test.local`
  const password = `Test-${stamp}-Aa1!`
  const username = `obv${String(stamp).slice(-8)}`

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await context.addCookies([
    { name: 'ironstack-locale-chosen', value: '1', domain: 'localhost', path: '/' },
    { name: 'ironstack-locale', value: 'en', domain: 'localhost', path: '/' },
  ])
  const page = await context.newPage()

  const visited = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url())
  })

  let userId = null

  try {
    await page.goto(`${BASE}/login?mode=signup`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /create account/i }).click()
    await page.locator('#signup-username').fill(username)
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password)
    await page.locator('#confirmPassword').fill(password)
    await page.locator('input[type="checkbox"]').check()
    await page.locator('form button[type="submit"]').click()

    await page.waitForURL(/\/onboarding/, { timeout: 45000 })

    // Step 1 — profile basics (username prefilled from signup)
    await page.locator('input[autocomplete="name"]').fill('Verify User')
    await clickContinue(page)

    // Step 2 — optional demographics
    await page.getByRole('button', { name: /skip for now/i }).click()

    // Step 3 — optional body stats
    await page.getByRole('button', { name: /skip for now/i }).click()

    // Step 4 — primary goal
    await page.getByRole('button', { name: /build muscle/i }).first().click()
    await clickContinue(page)

    // Step 5 — schedule
    await page.getByRole('button', { name: /^beginner$/i }).click()
    await page.getByRole('button', { name: /^3$/ }).click()
    await page.getByRole('button', { name: /30.?45/i }).click()
    await clickContinue(page)

    // Step 6 — location
    await page.getByRole('button', { name: /^home$/i }).click()
    await clickContinue(page)

    // Step 7 — preferences (optional)
    await page.getByRole('button', { name: /skip for now/i }).click()

    // Step 8 — review (must NOT show recommendations)
    const bodyText = await page.locator('main').innerText()
    if (/program options|split recommendations|recommended splits/i.test(bodyText)) {
      throw new Error('step 8 review shows recommendations copy')
    }
    if (await page.locator('[data-tour="split-recommendations-panel"]').count()) {
      throw new Error('split recommendations panel visible at step 8')
    }

    await page.getByRole('button', { name: /create my plan/i }).click()
    await page.waitForURL(/\/dashboard\/home/, { timeout: 60000 })

    const finalUrl = page.url()
    if (!finalUrl.includes('tour=1')) {
      throw new Error(`expected tour=1 after onboarding, got ${finalUrl}`)
    }
    if (visited.some((u) => u.includes('/dashboard/splits/recommendations'))) {
      throw new Error('onboarding navigated through recommendations page')
    }

    await page.goto(`${BASE}/dashboard/splits/new`, { waitUntil: 'domcontentloaded' })
    const recLink = page.locator('[data-tour="create-split-recommended"]')
    await recLink.waitFor({ state: 'visible', timeout: 15000 })
    const href = await recLink.getAttribute('href')
    if (!href?.includes('/dashboard/splits/recommendations')) {
      throw new Error(`create split recommended href missing: ${href}`)
    }

    const {
      data: { users },
    } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    userId = users.find((u) => u.email === email)?.id ?? null

    console.log(
      JSON.stringify(
        {
          staticOk: true,
          freshSignupCompleted: true,
          finalUrl,
          createSplitRecommendationsHref: href,
        },
        null,
        2,
      ),
    )
    console.log('\nPASS: onboarding step 8 → app tour; Create Split recommendations intact.')
  } finally {
    await browser.close()
    if (userId) await admin.auth.admin.deleteUser(userId)
  }
}

async function main() {
  staticChecks()
  const env = loadEnv()
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
  await e2eFreshSignup(env)
}

main().catch((err) => {
  console.error('FAIL:', err.message || err)
  process.exit(1)
})
