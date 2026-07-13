/**
 * PR5B3 — Núcleo de auditoría de Storage (deps-inyectables, READ-ONLY).
 *
 * Recorre TODOS los objetos del bucket privado (BFS por prefijos con paginación; no asume que
 * `list()` sea recursivo) y los CRUZA con las referencias conocidas en DB. Clasifica sin
 * descargar contenido, sin firmar URLs y sin borrar/mover/copiar objetos. Distingue "objeto
 * huérfano" (en Storage sin referencia DB — NO se elimina) de "referencia rota" (en DB sin objeto).
 */

/** Firma mínima del `list` de Supabase Storage acotado a un bucket. */
export type SupabaseListFn = (
  prefix: string,
  opts: { limit: number; offset: number }
) => Promise<{ data: Array<{ name: string; id: string | null }> | null; error: unknown }>

export type ListLimitations = { truncatedAtMaxObjects: boolean; maxDepthReached: boolean }

/**
 * Recorre el bucket entero y devuelve TODOS los object paths (archivos), no solo prefijos conocidos.
 * Los "folders" en Supabase se distinguen por `id === null`. Pagina cada nivel. Acota profundidad y
 * nº máximo de objetos para no colgarse; reporta si tuvo que truncar (cobertura NO completa).
 */
export async function listAllObjectPaths(
  list: SupabaseListFn,
  opts: { pageSize?: number; maxDepth?: number; maxObjects?: number } = {}
): Promise<{ paths: string[]; limitations: ListLimitations }> {
  const pageSize = opts.pageSize ?? 1000
  const maxDepth = opts.maxDepth ?? 8
  const maxObjects = opts.maxObjects ?? 100_000
  const paths: string[] = []
  const limitations: ListLimitations = { truncatedAtMaxObjects: false, maxDepthReached: false }

  const queue: Array<{ prefix: string; depth: number }> = [{ prefix: '', depth: 0 }]
  while (queue.length > 0) {
    const { prefix, depth } = queue.shift()!
    if (depth > maxDepth) {
      limitations.maxDepthReached = true
      continue
    }
    let offset = 0
    // Pagina este prefijo hasta agotarlo.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await list(prefix, { limit: pageSize, offset })
      if (error) throw new Error(`error listando prefijo`)
      const entries = data ?? []
      for (const e of entries) {
        const full = prefix ? `${prefix}/${e.name}` : e.name
        if (e.id === null) {
          queue.push({ prefix: full, depth: depth + 1 }) // carpeta → recorrer
        } else {
          if (paths.length >= maxObjects) {
            limitations.truncatedAtMaxObjects = true
            return { paths, limitations }
          }
          paths.push(full)
        }
      }
      if (entries.length < pageSize) break
      offset += pageSize
    }
  }
  return { paths, limitations }
}

export type StorageObjectClass = 'referenced' | 'storage-only' | 'wrong-prefix'

/** Prefijos válidos de la convención (PR5A/PR5B1). */
export const VALID_STORAGE_PREFIXES = ['docs/', 'deliveries/'] as const

export function classifyStorageObject(
  path: string,
  referenced: ReadonlySet<string>
): StorageObjectClass {
  if (!VALID_STORAGE_PREFIXES.some((p) => path.startsWith(p))) return 'wrong-prefix'
  return referenced.has(path) ? 'referenced' : 'storage-only'
}

export type StorageAuditSummary = {
  totalStorageObjects: number
  referenced: number
  storageOnlyOrphans: number
  wrongPrefix: number
  dbOnlyBrokenReferences: number
  limitations: ListLimitations
}

/**
 * Cruza objetos de Storage con paths referenciados en DB. `storage-only` = huérfano candidato (NO
 * se elimina aquí); `db-only` = referencia rota (error). Todo determinista.
 */
export function crossReferenceStorage(
  storagePaths: string[],
  referencedPaths: ReadonlySet<string>,
  limitations: ListLimitations
): StorageAuditSummary {
  const storageSet = new Set(storagePaths)
  let referenced = 0
  let storageOnly = 0
  let wrongPrefix = 0
  for (const p of storagePaths) {
    const cls = classifyStorageObject(p, referencedPaths)
    if (cls === 'referenced') referenced++
    else if (cls === 'storage-only') storageOnly++
    else wrongPrefix++
  }
  let dbOnly = 0
  referencedPaths.forEach((ref) => {
    if (!storageSet.has(ref)) dbOnly++
  })

  return {
    totalStorageObjects: storagePaths.length,
    referenced,
    storageOnlyOrphans: storageOnly,
    wrongPrefix,
    dbOnlyBrokenReferences: dbOnly,
    limitations,
  }
}
