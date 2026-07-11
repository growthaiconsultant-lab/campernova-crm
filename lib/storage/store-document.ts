/**
 * PR5 — Subida de documento privado con compensación.
 *
 * Storage (Supabase) y PostgreSQL NO comparten una transacción distribuida. Para minimizar
 * objetos huérfanos, este orquestador sube el objeto y, si la persistencia de metadatos en
 * DB falla, ELIMINA el objeto recién subido (compensación inmediata) y propaga el error
 * original. Deps inyectables (cliente de storage ya acotado a su bucket + callback `persist`)
 * → testeable sin Supabase ni Prisma reales.
 */

/** Error técnico de una operación de Storage (NO un conflicto de negocio). */
export class StorageOperationError extends Error {
  constructor(message = 'Error al operar con el almacenamiento.') {
    super(message)
    this.name = 'StorageOperationError'
  }
}

/** Cliente de storage ya acotado a un bucket (equivalente a `supabase.storage.from(bucket)`). */
export type BucketScopedStorage = {
  upload: (
    path: string,
    bytes: ArrayBuffer,
    opts: { contentType: string; upsert: boolean }
  ) => Promise<{ error: unknown }>
  remove: (paths: string[]) => Promise<{ error: unknown }>
}

/**
 * Sube `bytes` a `path` (upsert:false → nunca sobrescribe un objeto existente) y ejecuta
 * `persist()` para crear los metadatos. Si `persist` falla, compensa eliminando el objeto y
 * relanza el error original. Si el upload falla, lanza `StorageOperationError` y no persiste.
 */
export async function uploadPrivateDocumentWithCompensation(args: {
  storage: BucketScopedStorage
  path: string
  bytes: ArrayBuffer
  contentType: string
  persist: () => Promise<void>
}): Promise<void> {
  const { error } = await args.storage.upload(args.path, args.bytes, {
    contentType: args.contentType,
    upsert: false,
  })
  if (error) throw new StorageOperationError('No se pudo subir el archivo.')

  try {
    await args.persist()
  } catch (err) {
    // Compensación: el objeto se subió pero la DB falló → elimínalo (best-effort) y
    // propaga el error ORIGINAL (no lo enmascares como error de storage).
    await args.storage.remove([args.path]).catch(() => {})
    throw err
  }
}
