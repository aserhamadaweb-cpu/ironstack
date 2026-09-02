/**
 * Dump ironstack-offline IndexedDB from a logged-in browser context.
 * Usage: node scripts/inspect-offline-idb.mjs [http://localhost:3000]
 */
import { chromium } from 'playwright'

const origin = process.argv[2] || 'http://localhost:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.includes('[ironstack-offline]')) console.log(text)
  })
  await page.goto(`${origin}/dashboard/workout`, { waitUntil: 'domcontentloaded' })
  const dump = await page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    const has = dbs.some((db) => db.name === 'ironstack-offline')
    if (!has) {
      return { ok: false, reason: 'no ironstack-offline database', href: location.href, dbs }
    }
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('ironstack-offline')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('sessions')) {
          resolve({ ok: false, reason: 'no sessions store', stores: [...db.objectStoreNames] })
          db.close()
          return
        }
        const tx = db.transaction('sessions', 'readonly')
        const getAll = tx.objectStore('sessions').getAll()
        getAll.onsuccess = () => {
          const sessions = getAll.result.map((row) => ({
            id: row.id,
            userId: row.userId,
            status: row.status,
            syncStatus: row.syncStatus,
            logs: Array.isArray(row.logs) ? row.logs.length : 0,
            syncError: row.syncError,
            updatedAt: row.updatedAt,
          }))
          db.close()
          resolve({
            ok: true,
            href: location.href,
            pending: sessions.filter((s) => s.syncStatus !== 'synced').length,
            sessions,
          })
        }
        getAll.onerror = () => {
          db.close()
          reject(getAll.error)
        }
      }
    })
  })
  console.log(JSON.stringify(dump, null, 2))
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
