/** Public URL prefix for Gym visual thumbnails (copied from the dataset images/). */
export const EXERCISE_IMAGE_PUBLIC_DIR = '/exercises/images'

/** Public URL prefix for Gym visual animation GIFs (copied from the dataset videos/). */
export const EXERCISE_GIF_PUBLIC_DIR = '/exercises/gifs'

export const GYM_VISUAL_ATTRIBUTION = '© Gym visual — https://gymvisual.com/'
export const GYM_VISUAL_URL = 'https://gymvisual.com/'
export const GYM_VISUAL_TERMS_URL =
  'https://gymvisual.com/content/3-terms-and-conditions-of-use'

export function localImageUrlFromSource(image: string): string {
  const file = image.replace(/^images\//, '').replace(/^\/+/, '')
  return `${EXERCISE_IMAGE_PUBLIC_DIR}/${file}`
}

export function localGifUrlFromSource(gifUrl: string): string {
  const file = gifUrl
    .replace(/^videos\//, '')
    .replace(/^gifs\//, '')
    .replace(/^\/+/, '')
  return `${EXERCISE_GIF_PUBLIC_DIR}/${file}`
}

/** Same media id as a local thumbnail, as a looping GIF. */
export function gifUrlFromImageUrl(
  image: string | null | undefined,
): string | null {
  const raw = image?.trim()
  if (!raw) return null
  const local = raw.match(/\/exercises\/images\/([^/?#]+)\.[a-z0-9]+$/i)
  if (local) return `${EXERCISE_GIF_PUBLIC_DIR}/${local[1]}.gif`
  const source = raw.match(/(?:^|\/)images\/([^/?#]+)\.[a-z0-9]+$/i)
  if (source) return localGifUrlFromSource(`videos/${source[1]}.gif`)
  return null
}

export function imageFilenameFromSource(image: string): string {
  return image.replace(/^images\//, '').replace(/^\/+/, '')
}

export function gifFilenameFromSource(gifUrl: string): string {
  return gifUrl
    .replace(/^videos\//, '')
    .replace(/^gifs\//, '')
    .replace(/^\/+/, '')
}
