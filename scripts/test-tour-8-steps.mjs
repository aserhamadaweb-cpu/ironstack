/**
 * @deprecated Tour is now 17 active steps. Delegates to test-tour-10-steps.mjs.
 */
import { spawnSync } from 'node:child_process'

console.warn('test-tour-8-steps.mjs is deprecated — running test-tour-10-steps.mjs instead.')
const result = spawnSync(process.execPath, ['scripts/test-tour-10-steps.mjs'], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
