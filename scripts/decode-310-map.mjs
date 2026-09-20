import fs from 'fs'
import path from 'path'
import { SourceMapConsumer } from 'source-map'

const dir = '.next/static/chunks'
const js = fs.readdirSync(dir).find((f) => f.startsWith('8928') && f.endsWith('.js'))
const raw = JSON.parse(fs.readFileSync(path.join(dir, js + '.map'), 'utf8'))
const consumer = await new SourceMapConsumer(raw)

const ours = (raw.sources || []).filter(
  (s) => s.includes('components/') || s.includes('lib/') || s.includes('app/'),
)
console.log('app-ish sources in 8928 (' + ours.length + '):')
for (const s of ours.slice(0, 60)) console.log(' ', s)

console.log('\npositions:')
for (const c of [156630, 156620, 132657]) {
  console.log(c, consumer.originalPositionFor({ line: 1, column: c }))
}

// Find function F by searching the JS for nearby unique strings around col 156630
const code = fs.readFileSync(path.join(dir, js), 'utf8')
const snippet = code.slice(Math.max(0, 156500), 157200)
console.log('\nsnippet around F:\n', snippet.slice(0, 400))
