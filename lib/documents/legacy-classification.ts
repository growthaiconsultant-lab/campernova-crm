/**
 * PR5B3 — Clasificación estable de referencias documentales legacy (PURA, sin DB/red/env).
 *
 * Reproduce la semántica del extractor de PR5A (`extractVehicleDocumentPath`) pero además
 * DISTINGUE el tipo de referencia y detecta buckets inesperados, para poder decidir qué se
 * puede migrar automáticamente (VALID_PATH / VALID_LEGACY_SIGNED_URL) y qué queda BLOQUEADO
 * para revisión humana. No inventa datos; no accede a Storage (las clases que dependen de
 * Storage —objeto ausente / objeto sin referencia— las decide la auditoría de Storage).
 */

export const PRIVATE_DOCUMENTS_BUCKET = 'vehicle-documents'

/** Clasificaciones estables (usadas en informes, planes y tests). */
export type LegacyClassification =
  | 'STRUCTURED' // ya versionado y coherente → no tocar
  | 'VALID_PATH' // `url` es un object path interno válido → migrable
  | 'VALID_LEGACY_SIGNED_URL' // `url` es una URL firmada antigua del bucket esperado → migrable
  | 'EXTERNAL_URL' // dominio/endpoint no reconocido → revisión
  | 'WRONG_BUCKET' // referencia a lead-documents / vehicle-photos / otro bucket → revisión
  | 'INVALID_REFERENCE' // malformada / vacía tras parseo / traversal → revisión
  | 'MISSING_REFERENCE' // `url` nulo/vacío → revisión
  | 'ALREADY_VERSIONED_INCONSISTENT' // currentVersionId/versionSequence/versiones incoherentes → error crítico

/** Resultado del parseo de una referencia (`url`). */
export type ParsedReference =
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'external' }
  | { kind: 'path'; bucket: string; objectPath: string }
  | { kind: 'signed_url'; bucket: string; objectPath: string }
  | { kind: 'wrong_bucket'; bucket: string; objectPath: string }

/** Path interno seguro: no vacío, sin barra inicial, sin traversal ni caracteres de control. */
function isSafeObjectPath(p: string): boolean {
  // eslint-disable-next-line no-control-regex
  return !!p && !p.startsWith('/') && !p.includes('..') && !/[\x00-\x1f]/.test(p)
}

/**
 * Parsea el valor de `url`. Con un path interno seguro → `path` (bucket = esperado, pues los
 * paths internos no codifican bucket). Con una URL http de Storage (`/storage/v1/object/...`)
 * → `signed_url` si el bucket coincide con el esperado, `wrong_bucket` si es otro. URLs http que
 * no sean endpoints de Storage → `external`. Cualquier path/URL no resoluble de forma segura →
 * `invalid`. Coherente con el re-firmado de PR5A (que ignora el host y solo usa bucket + path).
 */
export function parseLegacyReference(
  value: string | null | undefined,
  expectedBucket: string = PRIVATE_DOCUMENTS_BUCKET
): ParsedReference {
  if (!value || value.trim() === '') return { kind: 'missing' }

  if (!value.startsWith('http')) {
    return isSafeObjectPath(value)
      ? { kind: 'path', bucket: expectedBucket, objectPath: value }
      : { kind: 'invalid', reason: 'path inseguro (vacío/traversal/control/leading-slash)' }
  }

  // URL http: debe ser un endpoint de Storage `/storage/v1/object/{sign|public|authenticated}/<bucket>/<path>`.
  const objMarker = '/storage/v1/object/'
  const oi = value.indexOf(objMarker)
  if (oi === -1) return { kind: 'external' }

  let rest = value.slice(oi + objMarker.length)
  // Salta el modo de acceso opcional (sign/public/authenticated/upload).
  for (const mode of ['sign/', 'public/', 'authenticated/', 'upload/sign/']) {
    if (rest.startsWith(mode)) {
      rest = rest.slice(mode.length)
      break
    }
  }
  const slash = rest.indexOf('/')
  if (slash <= 0) return { kind: 'invalid', reason: 'no se pudo extraer bucket/path del endpoint' }

  const bucket = rest.slice(0, slash)
  let objectPath = rest.slice(slash + 1)
  const q = objectPath.indexOf('?')
  if (q !== -1) objectPath = objectPath.slice(0, q) // descarta la firma
  objectPath = decodeURIComponent(objectPath)

  if (!isSafeObjectPath(objectPath)) {
    return { kind: 'invalid', reason: 'path extraído inseguro' }
  }
  return bucket === expectedBucket
    ? { kind: 'signed_url', bucket, objectPath }
    : { kind: 'wrong_bucket', bucket, objectPath }
}

/** Estado mínimo de la raíz + su versión actual, para clasificar (lo aporta la auditoría DB). */
export type LegacyDocumentInput = {
  rootType: 'vehicle' | 'delivery'
  rootId: string
  url: string | null
  currentVersionId: string | null
  versionSequence: number
  /** nº de filas DocumentVersion que pertenecen a esta raíz. */
  versionCount: number
  /** La versión apuntada por currentVersionId, si existe (con su dueño real para validar pertenencia). */
  currentVersion?: {
    id: string
    version: number
    objectPath: string
    ownerRootId: string | null
    status: string
  } | null
  expectedBucket?: string
}

export type ClassificationResult = {
  classification: LegacyClassification
  reason: string
  /** Bucket/objectPath resueltos (solo para clases migrables). */
  bucket?: string
  objectPath?: string
  /** true → puede migrarse automáticamente (crear versión 1). */
  migratable: boolean
  /** true → bloqueado para revisión/fase operativa posterior. */
  blocked: boolean
}

/**
 * Clasifica un documento legacy de forma determinista. No accede a Storage: `LEGACY_OBJECT_MISSING`
 * y `STORAGE_ONLY_OBJECT` los decide la auditoría de Storage cruzando con este resultado.
 */
export function classifyLegacyDocument(input: LegacyDocumentInput): ClassificationResult {
  const expectedBucket = input.expectedBucket ?? PRIVATE_DOCUMENTS_BUCKET

  // 1) Ya tiene puntero de versión actual → debe ser coherente (STRUCTURED) o crítico.
  if (input.currentVersionId) {
    const cv = input.currentVersion
    if (!cv) {
      return crit('currentVersionId apunta a una versión inexistente')
    }
    if (cv.id !== input.currentVersionId) {
      return crit('la versión cargada no es la apuntada por currentVersionId')
    }
    if (cv.ownerRootId !== input.rootId) {
      return crit('la versión actual pertenece a otra raíz')
    }
    if (input.versionSequence < 1) {
      return crit('versionSequence < 1 con currentVersionId establecido')
    }
    if (cv.status === 'DELETED') {
      return crit('la versión actual está marcada como DELETED')
    }
    if (input.url && input.url !== cv.objectPath) {
      // `url` debe estar sincronizada con el objectPath de la versión actual.
      return crit('url no coincide con el objectPath de la versión actual')
    }
    return {
      classification: 'STRUCTURED',
      reason: 'documento ya versionado y coherente',
      migratable: false,
      blocked: false,
    }
  }

  // 2) Sin puntero pero con versiones → incoherente.
  if (input.versionCount > 0) {
    return crit('existen DocumentVersion sin currentVersionId en la raíz')
  }

  // 3) Legacy sin versiones → clasifica por la referencia `url`.
  const parsed = parseLegacyReference(input.url, expectedBucket)
  switch (parsed.kind) {
    case 'missing':
      return blockedResult('MISSING_REFERENCE', 'url vacío o nulo')
    case 'invalid':
      return blockedResult('INVALID_REFERENCE', parsed.reason)
    case 'external':
      return blockedResult('EXTERNAL_URL', 'la url no es un endpoint de Storage reconocido')
    case 'wrong_bucket':
      return {
        classification: 'WRONG_BUCKET',
        reason: `la referencia apunta al bucket '${parsed.bucket}', no a '${expectedBucket}'`,
        bucket: parsed.bucket,
        objectPath: parsed.objectPath,
        migratable: false,
        blocked: true,
      }
    case 'path':
      return {
        classification: 'VALID_PATH',
        reason: 'object path interno válido',
        bucket: parsed.bucket,
        objectPath: parsed.objectPath,
        migratable: true,
        blocked: false,
      }
    case 'signed_url':
      return {
        classification: 'VALID_LEGACY_SIGNED_URL',
        reason: 'url firmada legacy del bucket esperado; path extraíble',
        bucket: parsed.bucket,
        objectPath: parsed.objectPath,
        migratable: true,
        blocked: false,
      }
  }
}

function crit(reason: string): ClassificationResult {
  return {
    classification: 'ALREADY_VERSIONED_INCONSISTENT',
    reason,
    migratable: false,
    blocked: true,
  }
}

function blockedResult(c: LegacyClassification, reason: string): ClassificationResult {
  return { classification: c, reason, migratable: false, blocked: true }
}

/** Todas las clasificaciones posibles (para agregados de informe con ceros explícitos). */
export const ALL_CLASSIFICATIONS: LegacyClassification[] = [
  'STRUCTURED',
  'VALID_PATH',
  'VALID_LEGACY_SIGNED_URL',
  'EXTERNAL_URL',
  'WRONG_BUCKET',
  'INVALID_REFERENCE',
  'MISSING_REFERENCE',
  'ALREADY_VERSIONED_INCONSISTENT',
]
