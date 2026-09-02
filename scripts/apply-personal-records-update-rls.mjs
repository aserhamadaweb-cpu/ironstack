/**
 * Apply fix-personal-records-update-rls.sql using direct Postgres connection.
 * Requires SUPABASE_DB_PASSWORD in .env.local (database password, not service role).
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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

const env = loadEnv()
const password = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error(
    'Add SUPABASE_DB_PASSWORD (project database password) to .env.local, or run supabase/fix-personal-records-update-rls.sql in the SQL editor.',
  )
  process.exit(1)
}

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const sql = readFileSync(
  join(root, 'supabase/fix-personal-records-update-rls.sql'),
  'utf8',
)

const inline = `
import pg from 'pg';
const client = new pg.Client({
  host: 'db.${ref}.supabase.co',
  port: 5432,
  user: 'postgres',
  password: ${JSON.stringify(password)},
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(${JSON.stringify(sql)});
await client.end();
console.log('Migration applied.');
`

const result = spawnSync(
  'npx',
  ['--yes', '-p', 'pg@8', 'node', '--input-type=module', '-e', inline],
  { stdio: 'inherit', shell: true, cwd: root },
)

process.exit(result.status ?? 1)
