// OBS-1: offline, one-off derivative. Uses the installed Next 14 encoder, not AI.
// Run manually with node scripts/optimize-landing-hero.mjs. Never part of the build.
// The PNG is preserved; an existing derivative is never overwritten.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import imageOptimizer from 'next/dist/server/image-optimizer.js'

const { optimizeImage, getImageSize } = imageOptimizer
const scriptDirectory = dirname(fileURLToPath(import.meta.url))

async function main() {
  const source = resolve(
    scriptDirectory,
    '../public/images/landing/ChatGPT Image 4 may 2026, 09_40_45.png'
  )
  const target = resolve(scriptDirectory, '../public/images/landing/hero-mountain.webp')
  const original = readFileSync(source)
  const output = await optimizeImage({
    buffer: original,
    contentType: 'image/webp',
    width: 1536,
    quality: 75,
  })
  const { width, height } = await getImageSize(output, 'webp')
  if (width !== 1536 || height !== 1024 || output.length > 350 * 1024) {
    throw new Error('Hero derivative does not meet dimensions/byte budget; no file written')
  }
  writeFileSync(target, output, { flag: 'wx' })
  console.log(
    JSON.stringify({ originalBytes: original.length, bytes: output.length, width, height })
  )
}

main().then(
  // The fallback encoder owns worker threads; all writes above are synchronous.
  () => process.exit(0),
  (error) => {
    console.error(error.message)
    process.exit(1)
  }
)
