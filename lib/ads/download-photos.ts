import JSZip from 'jszip'
import { db } from '@/lib/db'

export async function downloadVehiclePhotosZip(vehicleId: string): Promise<Buffer> {
  const [photos, vehicle] = await Promise.all([
    db.vehiclePhoto.findMany({
      where: { vehicleId },
      orderBy: { order: 'asc' },
    }),
    db.vehicle.findUnique({ where: { id: vehicleId } }),
  ])

  if (!vehicle) throw new Error('Vehicle not found')

  const zip = new JSZip()

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const res = await fetch(photo.url)
    if (!res.ok) continue
    const arrayBuffer = await res.arrayBuffer()
    const ext = photo.url.split('.').pop()?.split('?')[0] ?? 'jpg'
    const filename = `${String(i + 1).padStart(2, '0')}-foto.${ext}`
    zip.file(filename, arrayBuffer)
  }

  return Buffer.from(await zip.generateAsync({ type: 'arraybuffer' }))
}

export function buildZipFilename(vehicle: {
  brand: string
  model: string
  year: number
  id: string
}): string {
  const slug = `${vehicle.brand}-${vehicle.model}-${vehicle.year}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug}-${vehicle.id.slice(0, 6).toLowerCase()}.zip`
}
