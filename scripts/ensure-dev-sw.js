const fs = require('fs')
const path = require('path')

/** Ensure push-only sw.js exists in development (production build overwrites it). */
const root = path.join(__dirname, '..')
const dest = path.join(root, 'public', 'sw.js')
const src = path.join(root, 'public', 'sw.dev.js')

if (!fs.existsSync(src)) {
  console.warn('[ensure-dev-sw] missing public/sw.dev.js')
  process.exit(0)
}

const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : ''
// Workbox bundles are large and contain importScripts — replace for local push.
if (!current || current.includes('workbox') || current.includes('importScripts')) {
  fs.copyFileSync(src, dest)
  console.log('[ensure-dev-sw] restored push-only public/sw.js for development')
}
