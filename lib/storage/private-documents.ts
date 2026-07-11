/**
 * PR5 — Seguridad de documentos privados (validación + object paths seguros).
 *
 * Módulo PURO (sin Supabase, sin Prisma, sin React): valida archivos server-side y
 * construye object paths internos que NO dependen del nombre de fichero del usuario ni
 * contienen PII, y son resistentes a path traversal y colisiones. Se usa desde las Server
 * Actions de subida de documentos privados (vehículo, entrega) para no confiar en el
 * cliente ni en la extensión declarada por el navegador.
 *
 * Alcance deliberado: los documentos privados viven en un bucket privado y se acceden con
 * URLs firmadas de corta duración generadas server-side (nunca URLs públicas ni firmadas de
 * larga duración persistidas). El versionado real (version/isCurrent/estado) requiere un
 * cambio de esquema y queda documentado como bloqueo, fuera de este módulo.
 */

/** Tamaño máximo de un documento privado (10 MB). */
export const MAX_PRIVATE_DOCUMENT_BYTES = 10 * 1024 * 1024

/**
 * TTL de las URLs firmadas de acceso a documentos privados (5 min). Se generan bajo
 * demanda, justo antes de abrir el documento; no se persisten en la base de datos.
 */
export const PRIVATE_DOC_SIGNED_URL_TTL_SECONDS = 300

/**
 * Allowlist de tipos permitidos: PDF, imágenes y ofimática. Excluye deliberadamente
 * SVG/HTML/scripts/ejecutables (evita XSS almacenado y contenido activo). El MIME
 * declarado debe ser coherente con la extensión.
 */
export const ALLOWED_PRIVATE_DOCUMENT_TYPES: ReadonlyArray<{
  mime: string
  ext: readonly string[]
}> = [
  { mime: 'application/pdf', ext: ['pdf'] },
  { mime: 'image/jpeg', ext: ['jpg', 'jpeg'] },
  { mime: 'image/png', ext: ['png'] },
  { mime: 'image/webp', ext: ['webp'] },
  { mime: 'application/msword', ext: ['doc'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: ['docx'],
  },
  { mime: 'application/vnd.ms-excel', ext: ['xls'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: ['xlsx'],
  },
]

export type DocumentValidationCode =
  | 'empty'
  | 'too_large'
  | 'invalid_name'
  | 'mime_not_allowed'
  | 'extension_mismatch'

/** Archivo rechazado por validación (NO un error técnico). Mensaje seguro para el usuario. */
export class DocumentValidationError extends Error {
  readonly code: DocumentValidationCode
  constructor(code: DocumentValidationCode, message: string) {
    super(message)
    this.name = 'DocumentValidationError'
    this.code = code
  }
}

const VALIDATION_MESSAGES: Record<DocumentValidationCode, string> = {
  empty: 'El archivo está vacío.',
  too_large: 'El archivo supera el tamaño máximo permitido (10 MB).',
  invalid_name: 'El nombre del archivo no es válido.',
  mime_not_allowed: 'Tipo de archivo no permitido.',
  extension_mismatch: 'La extensión del archivo no coincide con su tipo.',
}

export type FileToValidate = { mimeType: string; fileName: string; size: number }

/**
 * Valida un archivo server-side y devuelve la extensión canónica a usar en el object path.
 * Lanza `DocumentValidationError` (mensaje seguro) si el archivo no es aceptable.
 *
 * Comprueba: no vacío; dentro del límite; nombre sin path traversal/control chars; MIME en
 * la allowlist; y coherencia MIME↔extensión (evita el truco de doble extensión).
 */
export function validateDocumentFile(file: FileToValidate): { ext: string } {
  if (!file.size || file.size <= 0) {
    throw new DocumentValidationError('empty', VALIDATION_MESSAGES.empty)
  }
  if (file.size > MAX_PRIVATE_DOCUMENT_BYTES) {
    throw new DocumentValidationError('too_large', VALIDATION_MESSAGES.too_large)
  }

  const name = (file.fileName ?? '').trim()
  // Nombre inválido: vacío, con separadores de ruta, `..`, o caracteres de control.
  // eslint-disable-next-line no-control-regex
  if (!name || /[\\/]/.test(name) || name.includes('..') || /[\x00-\x1f]/.test(name)) {
    throw new DocumentValidationError('invalid_name', VALIDATION_MESSAGES.invalid_name)
  }

  const allowed = ALLOWED_PRIVATE_DOCUMENT_TYPES.find((t) => t.mime === file.mimeType)
  if (!allowed) {
    throw new DocumentValidationError('mime_not_allowed', VALIDATION_MESSAGES.mime_not_allowed)
  }

  // La extensión declarada debe existir y ser coherente con el MIME (la primera de la lista
  // es la canónica que usaremos en el path — así no arrastramos el nombre del usuario).
  const dotIdx = name.lastIndexOf('.')
  const declaredExt = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : ''
  if (!declaredExt || !allowed.ext.includes(declaredExt)) {
    throw new DocumentValidationError('extension_mismatch', VALIDATION_MESSAGES.extension_mismatch)
  }

  return { ext: allowed.ext[0] }
}

const SAFE_ID = /^[a-zA-Z0-9_-]+$/

/**
 * Construye un object path interno seguro: `<prefix>/<entityId>/<documentId>.<ext>`.
 * `documentId` lo genera el servidor (p. ej. `randomUUID()`), NO el usuario. No incluye
 * nombre original, PII, ni permite traversal. Lanza si algún segmento es inseguro.
 */
export function safeDocumentObjectPath(args: {
  prefix: string
  entityId: string
  documentId: string
  ext: string
}): string {
  const { prefix, entityId, documentId, ext } = args
  for (const [label, value] of [
    ['prefix', prefix],
    ['entityId', entityId],
    ['documentId', documentId],
    ['ext', ext],
  ] as const) {
    if (!value || !SAFE_ID.test(value)) {
      throw new DocumentValidationError('invalid_name', `Segmento de ruta no válido (${label}).`)
    }
  }
  return `${prefix}/${entityId}/${documentId}.${ext}`
}

/** Normaliza un nombre de presentación (solo UX): sin control chars, recortado a 200. */
export function normalizeDisplayName(
  name: string | null | undefined,
  fallback = 'documento'
): string {
  const cleaned = (name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '')
    .trim()
    .slice(0, 200)
  return cleaned || fallback
}
