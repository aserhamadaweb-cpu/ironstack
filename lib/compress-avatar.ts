/**
 * Client-side avatar prep: resize to max 512² and compress before upload.
 * Prefer WebP when the browser supports it; fall back to JPEG @ ~80%.
 */

const MAX_EDGE = 512
const TARGET_BYTES = 200 * 1024
const QUALITY_START = 0.8
const QUALITY_FLOOR = 0.55

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not compress image.'))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

function supportsWebp(): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

export type CompressedAvatar = {
  file: File
  previewUrl: string
  width: number
  height: number
}

/**
 * Resize (cover-crop to square) and compress an image for avatar upload.
 */
export async function compressAvatarImage(file: File): Promise<CompressedAvatar> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Please choose a JPG, PNG, or WebP image.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5MB or smaller.')
  }

  const img = await loadImage(file)
  const srcSize = Math.min(img.naturalWidth, img.naturalHeight)
  if (srcSize < 1) throw new Error('Invalid image dimensions.')

  const edge = Math.min(MAX_EDGE, srcSize)
  const sx = (img.naturalWidth - srcSize) / 2
  const sy = (img.naturalHeight - srcSize) / 2

  const canvas = document.createElement('canvas')
  canvas.width = edge
  canvas.height = edge
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable in this browser.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, edge, edge)

  const useWebp = supportsWebp()
  const mime = useWebp ? 'image/webp' : 'image/jpeg'
  const ext = useWebp ? 'webp' : 'jpg'

  let quality = QUALITY_START
  let blob = await canvasToBlob(canvas, mime, quality)

  while (blob.size > TARGET_BYTES && quality > QUALITY_FLOOR) {
    quality = Math.max(QUALITY_FLOOR, quality - 0.1)
    blob = await canvasToBlob(canvas, mime, quality)
  }

  const compressed = new File([blob], `avatar.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  })

  return {
    file: compressed,
    previewUrl: URL.createObjectURL(compressed),
    width: edge,
    height: edge,
  }
}
