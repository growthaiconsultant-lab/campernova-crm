export const VEHICLE_PHOTOS_BUCKET = 'vehicle-photos'
export const VEHICLE_DOCUMENTS_BUCKET = 'vehicle-documents'

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

// ── vehicle-documents (private bucket — use signed URLs) ─────────────────────

export function deliveryDocumentPath(deliveryId: string, fileName: string) {
  return `${deliveryId}/${fileName}`
}

export function postventaPhotoPath(ticketId: string, fileName: string) {
  return `${ticketId}/${fileName}`
}

/**
 * Returns a signed URL for a private vehicle-document.
 * Must be called server-side (uses the service-role client or server client).
 */
export async function deliveryDocumentSignedUrl(
  supabase: {
    storage: {
      from: (b: string) => {
        createSignedUrl: (
          p: string,
          e: number
        ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
      }
    }
  },
  path: string,
  expirySec = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VEHICLE_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expirySec)
  if (error || !data) return null
  return data.signedUrl
}

export async function postventaPhotoSignedUrl(
  supabase: {
    storage: {
      from: (b: string) => {
        createSignedUrl: (
          p: string,
          e: number
        ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
      }
    }
  },
  path: string,
  expirySec = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VEHICLE_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expirySec)
  if (error || !data) return null
  return data.signedUrl
}

// ── VehicleDocument helpers (private bucket — signed URLs) ───────────────────

type SupabaseStorageClient = {
  storage: {
    from: (b: string) => {
      createSignedUrl: (
        p: string,
        e: number
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
      remove: (paths: string[]) => Promise<{ error: unknown }>
    }
  }
}

export function vehicleDocumentPath(vehicleId: string, fileName: string) {
  return `docs/${vehicleId}/${fileName}`
}

export async function vehicleDocumentSignedUrl(
  supabase: SupabaseStorageClient,
  path: string,
  expirySec = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VEHICLE_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expirySec)
  if (error || !data) return null
  return data.signedUrl
}

export async function deleteVehicleDocumentFile(
  supabase: SupabaseStorageClient,
  path: string
): Promise<boolean> {
  const { error } = await supabase.storage.from(VEHICLE_DOCUMENTS_BUCKET).remove([path])
  return !error
}
