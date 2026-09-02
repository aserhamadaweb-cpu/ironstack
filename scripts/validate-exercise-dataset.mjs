/**
 * Validate the imported Gym visual catalog (1,324 exercises).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPECTED = 1324
const REQUIRED_LANGS = ['en', 'es', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko', 'fr']
const REQUIRED_FIELDS = [
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

function main() {
  const jsonPath = path.join(root, 'data', 'exercises-dataset', 'exercises.json')
  const source = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const imagesDir = path.join(root, 'public', 'exercises', 'images')
  const gifsDir = path.join(root, 'public', 'exercises', 'gifs')
  const imageFiles = new Set(fs.readdirSync(imagesDir))
  const gifFiles = new Set(fs.readdirSync(gifsDir))
  const identity = JSON.parse(
    fs.readFileSync(path.join(root, 'data', 'exercises-dataset', 'identity-map.json'), 'utf8'),
  )
  const slim = JSON.parse(
    fs.readFileSync(path.join(root, 'public', 'offline', 'exercises.json'), 'utf8'),
  )

  const ids = new Set()
  const duplicateIds = []
  const missingNames = []
  const missingImages = []
  const missingGifs = []
  const mediaMismatch = []
  const droppedFields = []
  const missingLangs = []
  const brokenSlim = []

  for (const row of source) {
    if (ids.has(row.id)) duplicateIds.push(row.id)
    else ids.add(row.id)
    if (!row.name) missingNames.push(row.id)
    for (const field of REQUIRED_FIELDS) {
      if (!(field in row)) droppedFields.push(`${row.id}:${field}`)
    }
    for (const lang of REQUIRED_LANGS) {
      if (!row.instructions?.[lang] || !Array.isArray(row.instruction_steps?.[lang])) {
        missingLangs.push(`${row.id}:${lang}`)
      }
    }
    const imgFile = String(row.image).replace(/^images\//, '')
    const gifFile = String(row.gif_url).replace(/^videos\//, '')
    if (!imageFiles.has(imgFile)) missingImages.push(`${row.id}:${imgFile}`)
    if (!gifFiles.has(gifFile)) missingGifs.push(`${row.id}:${gifFile}`)
    const mediaFromImg = imgFile.replace(/^\d{4}-/, '').replace(/\.[^.]+$/, '')
    const mediaFromGif = gifFile.replace(/^\d{4}-/, '').replace(/\.[^.]+$/, '')
    if (
      imgFile.slice(0, 4) !== row.id ||
      gifFile.slice(0, 4) !== row.id ||
      mediaFromImg !== row.media_id ||
      mediaFromGif !== row.media_id
    ) {
      mediaMismatch.push(row.id)
    }
  }

  for (const row of slim) {
    if (!row.id || !row.name || !row.image?.startsWith('/exercises/images/')) {
      brokenSlim.push(row.id ?? '?')
    }
    if (row.instructions || row.gifUrl || row.gif_url) {
      brokenSlim.push(`${row.id}:slim-too-heavy`)
    }
  }

  const report = {
    sourceCount: source.length,
    importedCount: source.length,
    uniqueIds: ids.size,
    expected: EXPECTED,
    duplicateIds,
    missingNames,
    missingImages: missingImages.length,
    missingGifs: missingGifs.length,
    mediaMismatch: mediaMismatch.length,
    droppedFields: droppedFields.length,
    missingLangs: missingLangs.length,
    publicImages: imageFiles.size,
    publicGifs: gifFiles.size,
    slimCount: slim.length,
    brokenSlim: brokenSlim.slice(0, 10),
    matchedOldExercises: identity.matchedCount,
    newExercises: identity.newCount,
    unmatchedOldExercises: identity.unmatchedOldCount,
    notes: [
      'Legacy 873-exercise JSON removed; identity-map.json preserves old slug mappings.',
      'lift_types UUIDs are not modified by this filesystem validation.',
      'Run npm run seed:exercise-identities to insert unmatched catalog rows without changing existing ids.',
    ],
  }

  const ok =
    source.length === EXPECTED &&
    ids.size === EXPECTED &&
    duplicateIds.length === 0 &&
    missingNames.length === 0 &&
    missingImages.length === 0 &&
    missingGifs.length === 0 &&
    mediaMismatch.length === 0 &&
    droppedFields.length === 0 &&
    missingLangs.length === 0 &&
    slim.length === EXPECTED &&
    brokenSlim.length === 0

  fs.writeFileSync(
    path.join(root, 'data', 'exercises-dataset', 'validation-report.json'),
    JSON.stringify({ ...report, ok }, null, 2),
  )
  console.log(JSON.stringify({ ...report, ok }, null, 2))
  if (!ok) process.exitCode = 1
}

main()
