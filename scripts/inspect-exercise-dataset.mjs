/**
 * Phase 1 inspector — counts, schema, and media integrity for the
 * hasaneyldrm/exercises-dataset clone. Read-only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendor = path.join(root, 'vendor', 'exercises-dataset')
const jsonPath = path.join(vendor, 'data', 'exercises.json')
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

const required = [
  'id',
  'name',
  'category',
  'body_part',
  'equipment',
  'instructions',
  'instruction_steps',
  'muscle_group',
  'secondary_muscles',
  'target',
  'media_id',
  'image',
  'gif_url',
  'attribution',
  'created_at',
]

const keys = new Set()
const extra = new Set()
const langs = new Set()
const body = new Set()
const cat = new Set()
const equip = new Set()
const target = new Set()
const mg = new Set()
const ids = new Set()
const dup = []
const missingName = []
const missingImg = []
const missingGif = []
const mediaMismatch = []

const imgDir = new Set(fs.readdirSync(path.join(vendor, 'images')))
const gifDir = new Set(fs.readdirSync(path.join(vendor, 'videos')))

for (const row of json) {
  Object.keys(row).forEach((k) => keys.add(k))
  Object.keys(row)
    .filter((k) => !required.includes(k))
    .forEach((k) => extra.add(k))
  if (ids.has(row.id)) dup.push(row.id)
  else ids.add(row.id)
  if (!row.name) missingName.push(row.id)
  Object.keys(row.instructions || {}).forEach((l) => langs.add(l))
  body.add(row.body_part)
  cat.add(row.category)
  equip.add(row.equipment)
  target.add(row.target)
  mg.add(row.muscle_group)
  const imgFile = String(row.image || '').replace(/^images\//, '')
  const gifFile = String(row.gif_url || '').replace(/^videos\//, '')
  if (!imgDir.has(imgFile)) missingImg.push(`${row.id}:${imgFile}`)
  if (!gifDir.has(gifFile)) missingGif.push(`${row.id}:${gifFile}`)
  const idFromImg = imgFile.slice(0, 4)
  const idFromGif = gifFile.slice(0, 4)
  const mediaFromImg = imgFile.replace(/^\d{4}-/, '').replace(/\.[^.]+$/, '')
  const mediaFromGif = gifFile.replace(/^\d{4}-/, '').replace(/\.[^.]+$/, '')
  if (
    idFromImg !== row.id ||
    idFromGif !== row.id ||
    mediaFromImg !== row.media_id ||
    mediaFromGif !== row.media_id
  ) {
    mediaMismatch.push({
      id: row.id,
      media_id: row.media_id,
      imgFile,
      gifFile,
    })
  }
}

const usedImg = new Set(json.map((r) => String(r.image).replace(/^images\//, '')))
const usedGif = new Set(json.map((r) => String(r.gif_url).replace(/^videos\//, '')))
const unusedImg = [...imgDir].filter((f) => !usedImg.has(f))
const unusedGif = [...gifDir].filter((f) => !usedGif.has(f))

const report = {
  count: json.length,
  uniqueIds: ids.size,
  duplicates: dup,
  keys: [...keys],
  extraKeys: [...extra],
  langs: [...langs],
  bodyParts: [...body].sort(),
  categories: [...cat].sort(),
  equipmentCount: equip.size,
  equipment: [...equip].sort(),
  targetCount: target.size,
  muscleGroupCount: mg.size,
  missingName: missingName.length,
  missingImgCount: missingImg.length,
  missingGifCount: missingGif.length,
  mediaMismatchCount: mediaMismatch.length,
  mediaMismatchSample: mediaMismatch.slice(0, 5),
  imageFiles: imgDir.size,
  gifFiles: gifDir.size,
  unusedImg: unusedImg.length,
  unusedGif: unusedGif.length,
  sample: {
    id: json[0].id,
    name: json[0].name,
    image: json[0].image,
    gif_url: json[0].gif_url,
    media_id: json[0].media_id,
    attribution: json[0].attribution,
    instructionLangs: Object.keys(json[0].instructions),
    stepLangs: Object.keys(json[0].instruction_steps),
  },
}

console.log(JSON.stringify(report, null, 2))
