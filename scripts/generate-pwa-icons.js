const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

/**
 * Same plate-stack dumbbell silhouette as HubPreloader / IronStackMark:
 * three gold plates each side + silver gradient bar, on dark app background.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0E0E10"/>
  <!-- left plates (outer → inner) -->
  <rect x="86" y="208" width="22" height="96" rx="8" fill="#E8B54A" fill-opacity="0.45"/>
  <rect x="116" y="184" width="26" height="144" rx="8" fill="#E8B54A" fill-opacity="0.7"/>
  <rect x="150" y="152" width="30" height="208" rx="8" fill="#E8B54A"/>
  <!-- bar -->
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9B9A9F"/>
      <stop offset="50%" stop-color="#D4D3CE"/>
      <stop offset="100%" stop-color="#9B9A9F"/>
    </linearGradient>
  </defs>
  <rect x="184" y="236" width="144" height="40" rx="20" fill="url(#bar)"/>
  <!-- right plates (inner → outer) -->
  <rect x="332" y="152" width="30" height="208" rx="8" fill="#E8B54A"/>
  <rect x="370" y="184" width="26" height="144" rx="8" fill="#E8B54A" fill-opacity="0.7"/>
  <rect x="404" y="208" width="22" height="96" rx="8" fill="#E8B54A" fill-opacity="0.45"/>
</svg>`

const out = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(out, { recursive: true })

async function main() {
  const buf = Buffer.from(svg)
  await sharp(buf).resize(192, 192).png().toFile(path.join(out, 'icon-192x192.png'))
  await sharp(buf).resize(512, 512).png().toFile(path.join(out, 'icon-512x512.png'))
  await sharp(buf).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'))
  // Favicon-sized copy for browsers that hit /icon.png paths
  await sharp(buf).resize(32, 32).png().toFile(path.join(out, 'icon-32x32.png'))
  console.log('icons ok — plate-stack dumbbell')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
