/**
 * @deprecated Alias — runs test-tour-10-steps.mjs (current active tour).
 */
import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, ['scripts/test-tour-10-steps.mjs'], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
