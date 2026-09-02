/**
 * @deprecated Tour is now 10 active steps. Delegates to test-tour-10-steps.mjs.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
console.warn('test-tour-20-steps.mjs is deprecated — running test-tour-10-steps.mjs instead.')

const result = spawnSync(process.execPath, ['scripts/test-tour-10-steps.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
