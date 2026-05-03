export const VEHICLE_PHOTOS_BUCKET = 'vehicle-photos'

export function vehiclePhotoPath(vehicleId: string, fileName: string) {
  return `${vehicleId}/${fileName}`
}

export function vehiclePhotoPublicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  return `${base}/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/${path}`
}

export function extractVehiclePhotoPath(url: string) {
  const marker = `/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}
