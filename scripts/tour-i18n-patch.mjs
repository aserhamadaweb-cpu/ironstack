import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

const enTour = JSON.parse(
  fs.readFileSync(path.join(root, 'messages/tour.en.json'), 'utf8'),
)
const arTour = JSON.parse(
  fs.readFileSync(path.join(root, 'messages/tour.ar.json'), 'utf8'),
)

for (const [file, tour] of [
  ['messages/en.json', enTour],
  ['messages/ar.json', arTour],
]) {
  const p = path.join(root, file)
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  data.tour = tour
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log('patched', file)
}
