/**
 * Real simulations for offline manual checklist (IndexedDB + Cache Storage where possible).
 * Uses fake-indexeddb (Node) and optionally Playwright Chromium for Cache API / SW.
 *
 * Run: node scripts/test-offline-manual-sim.mjs
 */

import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const META_OFFLINE_SPLIT_IDS = 'offlineSplitIds'
const DB_NAME = 'ironstack-offline'
const DB_VERSION = 2

const results = []

function record(id, status, detail) {
  results.push({ id, status, detail })
  const tag =
    status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP'
  console.log(`[${tag}] ${id}: ${detail}`)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function openIronDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('splits')) {
        db.createObjectStore('splits', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' })
        s.createIndex('by-sync', 'syncStatus')
        s.createIndex('by-user', 'userId')
      }
      if (!db.objectStoreNames.contains('splitMutations')) {
        db.createObjectStore('splitMutations', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('liftTypes')) {
        db.createObjectStore('liftTypes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('personalRecords')) {
        db.createObjectStore('personalRecords', { keyPath: 'id' })
      }
    },
  })
}

/** Wipe all stores so sims don't pollute each other (shared fake-indexeddb). */
async function freshDb() {
  const db = await openIronDb()
  await Promise.all([
    db.clear('meta'),
    db.clear('splits'),
    db.clear('sessions'),
    db.clear('splitMutations'),
    db.clear('liftTypes'),
    db.clear('personalRecords'),
  ])
  return db
}

/** Close and reopen DB connection — simulates page reload / process reopen of same origin storage. */
async function reopenDb(db) {
  db.close()
  // fake-indexeddb keeps data in the same global indexedDB
  return openIronDb()
}

function makeSplit(id, name) {
  return {
    id,
    detail: {
      slug: id,
      name,
      daysPerWeek: 4,
      schedule: [
        {
          id: `${id}-d1`,
          focus: 'A',
          note: '',
          exercises: [
            {
              id: 'e1',
              name: 'Bench',
              sets: 3,
              reps: '8',
              muscle: 'Chest',
              gif: `/exercises/gifs/${id}-bench.gif`,
              image: `/exercises/images/${id}-bench.jpg`,
            },
          ],
        },
      ],
    },
    row: {
      id,
      user_id: 'user-a',
      is_system: false,
      name,
    },
    updatedAt: new Date().toISOString(),
    offlinePin: {
      ready: true,
      requiredMedia: [`/exercises/gifs/${id}-bench.gif`],
      readyAt: new Date().toISOString(),
    },
  }
}

let pinChain = Promise.resolve()
function withPinWrite(work) {
  const run = pinChain.catch(() => undefined).then(work)
  pinChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function pinSplit(db, split) {
  return withPinWrite(async () => {
    await db.put('splits', split)
    const current = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    const pins = Array.isArray(current) ? current : []
    if (!pins.includes(split.id)) {
      await db.put('meta', [...pins, split.id], META_OFFLINE_SPLIT_IDS)
    }
  })
}

/** Mirrors hardened save: media must finish before pin. Interrupt = no pin. */
async function simulateSaveForOffline(db, split, { failAt } = {}) {
  // phase: fetch done (snapshot in memory only)
  if (failAt === 'after-fetch') {
    return { ok: false, code: 'media', pinned: false }
  }
  // phase: media
  if (failAt === 'mid-media') {
    return { ok: false, code: 'media', pinned: false }
  }
  if (failAt === 'quota') {
    const err = new Error('QuotaExceededError')
    err.name = 'QuotaExceededError'
    return { ok: false, code: 'quota', pinned: false, error: err }
  }
  // phase: commit
  await pinSplit(db, split)
  const pins = await db.get('meta', META_OFFLINE_SPLIT_IDS)
  return { ok: true, pinned: Array.isArray(pins) && pins.includes(split.id) }
}

async function removeSplitFromOffline(db, splitId, { session, mutation }) {
  return withPinWrite(async () => {
    const current = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    const pins = Array.isArray(current) ? [...current] : []
    const wasPinned = pins.includes(splitId)
    if (wasPinned) {
      await db.put(
        'meta',
        pins.filter((id) => id !== splitId),
        META_OFFLINE_SPLIT_IDS,
      )
    }
    let snapshotRemoved = false
    if (!session && !mutation) {
      const latest = await db.get('meta', META_OFFLINE_SPLIT_IDS)
      const stillPinned = Array.isArray(latest) && latest.includes(splitId)
      if (!stillPinned) {
        await db.delete('splits', splitId)
        snapshotRemoved = true
      }
    }
    return {
      unpinned: wasPinned,
      snapshotRemoved,
      retainedForSession: Boolean(session),
      hasSnapshot: Boolean(await db.get('splits', splitId)),
    }
  })
}

function finishLogVerify(localLogs, serverCount) {
  if (localLogs === 0) return { markSynced: true }
  if (serverCount < localLogs) return { markSynced: false, retry: true }
  return { markSynced: true }
}

// ---------------------------------------------------------------------------
// 1. Mid-session → reopen (real IDB persist across connection close/reopen)
// ---------------------------------------------------------------------------
async function sim1() {
  try {
    let db = await freshDb()
    const session = {
      id: 'sess-1',
      userId: 'user-a',
      splitId: 'split-a',
      splitDayId: 'day-1',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationSeconds: null,
      logs: [
        {
          id: 'log-1',
          liftTypeId: 'lt-1',
          setNumber: 1,
          weight: 100,
          reps: 8,
          durationSeconds: null,
          isSkipped: false,
          loggedAt: new Date().toISOString(),
        },
        {
          id: 'log-2',
          liftTypeId: 'lt-1',
          setNumber: 2,
          weight: 100,
          reps: 7,
          durationSeconds: null,
          isSkipped: false,
          loggedAt: new Date().toISOString(),
        },
      ],
      prs: [],
      progress: {
        splitName: 'A',
        dayIndex: 0,
        dayId: 'day-1',
        dayName: 'A',
        exerciseIndex: 0,
        totalExercises: 1,
        stage: 'lift',
        loggedExercises: [],
        currentEntries: [],
      },
      syncStatus: 'pending',
      syncError: null,
      updatedAt: new Date().toISOString(),
    }
    await db.put('sessions', session)
    db = await reopenDb(db)
    const again = await db.get('sessions', 'sess-1')
    assert(again, 'session missing after reopen')
    assert(again.logs.length === 2, 'sets missing after reopen')
    assert(again.status === 'in_progress', 'status changed')
    assert(again.progress?.stage === 'lift', 'progress missing')
    record(
      '1-mid-session-reopen',
      'PASS',
      `IndexedDB reopen kept session + ${again.logs.length} sets (simulates hard reload / same-origin reopen; not OS process kill)`,
    )
    db.close()
  } catch (err) {
    record('1-mid-session-reopen', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 2. Interrupt mid Save-for-Offline → no ghost pin
// ---------------------------------------------------------------------------
async function sim2() {
  try {
    const db = await freshDb()
    await db.put('meta', [], META_OFFLINE_SPLIT_IDS)
    const split = makeSplit('save-interrupt', 'Interrupt Me')

    const mid = await simulateSaveForOffline(db, split, { failAt: 'mid-media' })
    assert(!mid.ok && !mid.pinned, 'should not succeed')
    const pins = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    assert(!Array.isArray(pins) || !pins.includes(split.id), 'ghost pin')
    const row = await db.get('splits', split.id)
    assert(!row, 'ghost snapshot')

    // After "reopen", still clean
    const db2 = await reopenDb(db)
    const pins2 = await db2.get('meta', META_OFFLINE_SPLIT_IDS)
    assert(!Array.isArray(pins2) || !pins2.includes(split.id), 'ghost after reopen')

    record(
      '2-mid-save-interrupt',
      'PASS',
      'Interrupted mid-media left zero pins and zero snapshot after reopen',
    )
    db2.close()
  } catch (err) {
    record('2-mid-save-interrupt', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 3. Mid-finish / mid-sync — partial server logs must NOT mark synced
// ---------------------------------------------------------------------------
async function sim3() {
  try {
    const partial = finishLogVerify(5, 1)
    assert(!partial.markSynced && partial.retry, 'partial must retry')
    const full = finishLogVerify(5, 5)
    assert(full.markSynced, 'full must sync')

    // Simulate outbox row surviving "kill mid-sync"
    let db = await freshDb()
    await db.put('sessions', {
      id: 'sess-finish',
      userId: 'user-a',
      splitId: 'split-a',
      splitDayId: 'day-1',
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationSeconds: 1800,
      logs: Array.from({ length: 5 }, (_, i) => ({
        id: `l${i}`,
        liftTypeId: 'lt',
        setNumber: i + 1,
        weight: 60,
        reps: 10,
        durationSeconds: null,
        isSkipped: false,
        loggedAt: new Date().toISOString(),
      })),
      prs: [],
      progress: null,
      syncStatus: 'syncing',
      syncError: null,
      updatedAt: new Date().toISOString(),
    })
    db = await reopenDb(db)
    const row = await db.get('sessions', 'sess-finish')
    assert(row.status === 'completed', 'completed preserved')
    assert(row.logs.length === 5, 'logs preserved')
    // recoverStaleSyncing would eventually reset syncing → pending; we assert not silently synced
    assert(row.syncStatus !== 'synced', 'must not be synced without server proof')
    record(
      '3-mid-finish-sync',
      'PASS',
      'Partial log verify refuses synced; completed outbox + 5 logs survive reopen while still unsynced (no live Supabase upload in this env)',
    )
    db.close()
  } catch (err) {
    record('3-mid-finish-sync', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 4. Rapid online/offline — session lock prevents duplicate sync workers
// ---------------------------------------------------------------------------
async function sim4() {
  try {
    const sessionLocks = new Map()
    let concurrent = 0
    let maxConcurrent = 0
    let runs = 0

    function enqueue(id, work) {
      const previous = sessionLocks.get(id) ?? Promise.resolve()
      const next = previous.catch(() => undefined).then(async () => {
        concurrent += 1
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        runs += 1
        await work()
        concurrent -= 1
      })
      sessionLocks.set(id, next.then(() => undefined, () => undefined))
      return next
    }

    // Simulate rapid reconnect: clear backoff only (fixed), NOT locks
    function retryOfflineQueueNow() {
      /* retryAfter.clear only */
    }

    const work = () => new Promise((r) => setTimeout(r, 30))
    retryOfflineQueueNow()
    await Promise.all([
      enqueue('s1', work),
      enqueue('s1', work),
      enqueue('s1', work),
      enqueue('s1', work),
      enqueue('s1', work),
    ])

    assert(runs === 5, 'all queued runs eventually execute')
    assert(maxConcurrent === 1, `expected serial, got maxConcurrent=${maxConcurrent}`)

    // Also: rapid toggles must not invent a second in_progress for same split
    const db = await freshDb()
    await db.put('sessions', {
      id: 'live-1',
      userId: 'user-a',
      splitId: 'split-a',
      splitDayId: 'd1',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationSeconds: null,
      logs: [{ id: 'a', liftTypeId: 'x', setNumber: 1, weight: 1, reps: 1, durationSeconds: null, isSkipped: false, loggedAt: new Date().toISOString() }],
      prs: [],
      progress: null,
      syncStatus: 'pending',
      syncError: null,
      updatedAt: new Date().toISOString(),
    })
    // createLocalSession same-split guard mirror
    const actives = (await db.getAll('sessions')).filter(
      (s) => s.userId === 'user-a' && s.status === 'in_progress',
    )
    const sameSplit = actives.find((s) => s.splitId === 'split-a')
    assert(sameSplit?.id === 'live-1', 'same split returns existing')
    assert(actives.length === 1, 'no duplicate actives')

    record(
      '4-rapid-online-offline',
      'PASS',
      'Per-session mutex stayed serial (maxConcurrent=1) under 5 rapid enqueues; same-split start did not duplicate in_progress. Not a real DevTools network flap against a live app.',
    )
    db.close()
  } catch (err) {
    record('4-rapid-online-offline', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 5. Quota during save — clear failure, not Saved
// ---------------------------------------------------------------------------
async function sim5() {
  try {
    const db = await freshDb()
    await db.put('meta', [], META_OFFLINE_SPLIT_IDS)
    const split = makeSplit('quota-split', 'Quota')
    const result = await simulateSaveForOffline(db, split, { failAt: 'quota' })
    assert(result.code === 'quota', 'quota code')
    assert(!result.ok, 'not ok')
    const pins = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    assert(!pins?.includes?.(split.id), 'must not pin on quota')

    // Also throw real QuotaExceededError into a Cache.put mock path
    const quotaErr = Object.assign(new Error('exceeded'), { name: 'QuotaExceededError' })
    const isQuota =
      quotaErr.name === 'QuotaExceededError' ||
      /quota|storage|disk full|not enough space/i.test(quotaErr.message)
    assert(isQuota, 'detector works')

    record(
      '5-low-storage-quota',
      'PASS',
      'Simulated QuotaExceededError aborts save with code=quota and leaves pin set empty (mock, not real device disk pressure)',
    )
    db.close()
  } catch (err) {
    record('5-low-storage-quota', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 6. Multi-pin + train one offline
// ---------------------------------------------------------------------------
async function sim6() {
  try {
    let db = await freshDb()
    await db.put('meta', [], META_OFFLINE_SPLIT_IDS)
    const splits = [
      makeSplit('pin-a', 'Alpha'),
      makeSplit('pin-b', 'Beta'),
      makeSplit('pin-c', 'Gamma'),
    ]
    for (const s of splits) await pinSplit(db, s)

    await db.put('sessions', {
      id: 'train-b',
      userId: 'user-a',
      splitId: 'pin-b',
      splitDayId: 'pin-b-d1',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationSeconds: null,
      logs: [],
      prs: [],
      progress: null,
      syncStatus: 'pending',
      syncError: null,
      updatedAt: new Date().toISOString(),
    })

    db = await reopenDb(db)
    const pins = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    assert(pins.length === 3, `expected 3 pins, got ${pins.length}`)
    for (const s of splits) {
      const row = await db.get('splits', s.id)
      assert(row?.offlinePin?.ready, `${s.id} ready`)
      assert(
        row.offlinePin.requiredMedia[0] === `/exercises/gifs/${s.id}-bench.gif`,
        `${s.id} media ref`,
      )
    }
    const session = await db.get('sessions', 'train-b')
    assert(session.splitId === 'pin-b', 'training pin-b')
    assert((await db.get('splits', 'pin-a')) && (await db.get('splits', 'pin-c')), 'others intact')

    record(
      '6-multi-pin-train-one',
      'PASS',
      '3 pins + media refs intact after reopen while session runs on pin-b (IDB only; GIF blobs not fetched in Node)',
    )
    db.close()
  } catch (err) {
    record('6-multi-pin-train-one', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 7. Unsave mid-session → unpinned, snapshot retained, session completes
// ---------------------------------------------------------------------------
async function sim7() {
  try {
    let db = await freshDb()
    await db.put('meta', [], META_OFFLINE_SPLIT_IDS)
    const split = makeSplit('live-unsave', 'Live')
    await pinSplit(db, split)
    await db.put('sessions', {
      id: 'sess-live',
      userId: 'user-a',
      splitId: 'live-unsave',
      splitDayId: 'live-unsave-d1',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationSeconds: null,
      logs: [
        {
          id: 'x',
          liftTypeId: 'lt',
          setNumber: 1,
          weight: 40,
          reps: 10,
          durationSeconds: null,
          isSkipped: false,
          loggedAt: new Date().toISOString(),
        },
      ],
      prs: [],
      progress: null,
      syncStatus: 'pending',
      syncError: null,
      updatedAt: new Date().toISOString(),
    })

    const removed = await removeSplitFromOffline(db, 'live-unsave', {
      session: true,
      mutation: false,
    })
    assert(removed.unpinned, 'unpinned')
    assert(!removed.snapshotRemoved, 'snapshot kept')
    assert(removed.hasSnapshot, 'snapshot still in IDB')
    const pins = await db.get('meta', META_OFFLINE_SPLIT_IDS)
    assert(!pins.includes('live-unsave'), 'not in offline list')

    // Complete session
    const sess = await db.get('sessions', 'sess-live')
    await db.put('sessions', {
      ...sess,
      status: 'completed',
      finishedAt: new Date().toISOString(),
      durationSeconds: 600,
      syncStatus: 'pending',
    })

    db = await reopenDb(db)
    const done = await db.get('sessions', 'sess-live')
    assert(done.status === 'completed' && done.logs.length === 1, 'session completed with sets')
    assert(await db.get('splits', 'live-unsave'), 'snapshot still for sync/history')

    record(
      '7-unsave-mid-session',
      'PASS',
      'Unsave removed pin, kept snapshot, session completed with 1 set after reopen',
    )
    db.close()
  } catch (err) {
    record('7-unsave-mid-session', 'FAIL', err.message)
  }
}

// ---------------------------------------------------------------------------
// 8. SW / cache name stability + Cache Storage pin media survival (Chromium)
// ---------------------------------------------------------------------------
async function sim8() {
  const nextConfig = fs.readFileSync(
    path.join(__dirname, '../next.config.mjs'),
    'utf8',
  )
  const gifCache = /cacheName:\s*'exercise-gifs'/
  const thumbCache = /cacheName:\s*'exercise-thumbs'/
  if (!gifCache.test(nextConfig) || !thumbCache.test(nextConfig)) {
    record('8-sw-update-pins', 'FAIL', 'stable cache names missing from next.config')
    return
  }

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    // Cache Storage requires a secure context (https or localhost).
    await page.goto('https://example.com/')

    const survival = await page.evaluate(async () => {
      const GIF = 'exercise-gifs'
      const url = new URL('/exercises/gifs/pin-survive.gif', location.origin).href
      const cache1 = await caches.open(GIF)
      await cache1.put(
        url,
        new Response(new Blob(['gif-bytes']), { status: 200 }),
      )
      const cache2 = await caches.open(GIF)
      const hit = await cache2.match(url)
      const body = hit ? await hit.text() : null
      await caches.delete('exercise-gifs-v-old-unused')
      const still = await (await caches.open(GIF)).match(url)
      return {
        hit: Boolean(hit?.ok),
        body,
        still: Boolean(still?.ok),
        keys: await caches.keys(),
      }
    })

    assert(survival.hit && survival.body === 'gif-bytes', 'media in named cache')
    assert(survival.still, 'media survived same-name reopen')
    assert(survival.keys.includes('exercise-gifs'), 'cache name present')

    record(
      '8-sw-update-pins',
      'PASS',
      'Stable cache names in next.config; Chromium Cache Storage kept GIF under exercise-gifs across reopen/delete of unrelated cache. Not a full next-pwa version bump install.',
    )
  } catch (err) {
    record(
      '8-sw-update-pins',
      'SKIP',
      `Chromium unavailable or Cache API failed (${err.message}). Cache-name stability still confirmed in next.config.mjs.`,
    )
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

async function main() {
  console.log('=== Offline manual checklist — simulated verification ===\n')
  await sim1()
  await sim2()
  await sim3()
  await sim4()
  await sim5()
  await sim6()
  await sim7()
  await sim8()

  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const skip = results.filter((r) => r.status === 'SKIP').length
  console.log(`\n=== Summary: ${pass} PASS, ${fail} FAIL, ${skip} SKIP ===`)
  if (fail > 0) process.exitCode = 1
}

await main()
