/**
 * @deprecated Tour is now 17 active steps. Delegates to test-tour-10-flow-375px.mjs.
 */
import { spawnSync } from 'node:child_process'

console.warn(
  'test-tour-8-flow-375px.mjs is deprecated — running test-tour-10-flow-375px.mjs instead.',
)
const result = spawnSync(
  process.execPath,
  ['scripts/test-tour-10-flow-375px.mjs'],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
