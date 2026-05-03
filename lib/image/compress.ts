const TARGET_MAX_BYTES = 1.5 * 1024 * 1024
const MAX_EDGE = 2000
const MIN_QUALITY = 0.4

export async function compressImage(file: File): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('compressImage runs only in the browser')
  }

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    throw new Error('No se pudo leer la imagen')
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  let quality = 0.85
  let blob = await canvasToBlob(canvas, quality)

  while (blob.size > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.1)
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size > TARGET_MAX_BYTES) {
    throw new Error('No se pudo comprimir la imagen por debajo de 1.5 MB')
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob falló'))),
      'image/jpeg',
      quality
    )
  })
}
