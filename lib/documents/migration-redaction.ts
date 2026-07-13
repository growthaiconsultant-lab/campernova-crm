/**
 * PR5B3 — Redacción para auditoría/backfill de documentos legacy.
 *
 * Utilidad PURA (sin DB, sin red, sin env) usada por TODOS los scripts de auditoría, plan,
 * aplicación, verificación y rollback para que sus informes y logs NUNCA expongan:
 *  - query strings de URLs firmadas (tokens);
 *  - tokens / credenciales;
 *  - object paths completos por defecto;
 *  - IDs internos en salida pública (se hashean de forma determinista);
 *  - PII (nombres, emails, teléfonos, DNI, matrículas, VIN) — que NO se leen ni imprimen.
 *
 * Los planes "protegidos" (que sí necesitan IDs y objectPaths reales para aplicarse) se generan
 * en `.artifacts/` (gitignored, fuera del repo); esta utilidad es para la salida pública/log.
 */
import { createHash } from 'node:crypto'

/** Elimina la query string (donde viven los tokens de firma) de una URL/valor. */
export function stripQueryString(value: string): string {
  const q = value.indexOf('?')
  return q === -1 ? value : value.slice(0, q)
}

/**
 * Hash corto y determinista de un id interno, para informes públicos que no deben exponer el id
 * real. Mismo id → mismo hash (permite correlacionar dentro de un informe sin filtrar el id).
 */
export function redactId(id: string | null | undefined): string {
  if (!id) return 'id:none'
  return 'id:' + createHash('sha256').update(id).digest('hex').slice(0, 12)
}

/**
 * Redacta un object path: conserva SOLO el primer segmento (prefijo, p. ej. `docs`/`deliveries`)
 * y la extensión; oculta el id de entidad y el uuid. Nunca revela el path completo.
 */
export function redactObjectPath(path: string | null | undefined): string {
  if (!path) return '(none)'
  const clean = stripQueryString(path)
  const segments = clean.split('/').filter(Boolean)
  if (segments.length === 0) return '(empty)'
  const prefix = segments[0]
  const last = segments[segments.length - 1]
  const dot = last.lastIndexOf('.')
  const ext = dot > 0 ? last.slice(dot).toLowerCase() : ''
  return segments.length <= 1 ? `***${ext}` : `${prefix}/***/***${ext}`
}

/** Descriptor SEGURO de una referencia legacy — nunca contiene token, query string ni path completo. */
export type RedactedReference = {
  present: boolean
  isHttp: boolean
  hadQueryString: boolean
  redactedPath: string
  length: number
}

/**
 * Describe una referencia (`VehicleDocument.url` / `DeliveryDocument.url`) de forma segura.
 * Para URLs http NO revela el host ni el path (solo marca que es una URL y si tenía query);
 * para paths internos revela solo prefijo + extensión.
 */
export function redactReference(value: string | null | undefined): RedactedReference {
  if (!value) {
    return {
      present: false,
      isHttp: false,
      hadQueryString: false,
      redactedPath: '(none)',
      length: 0,
    }
  }
  const isHttp = value.startsWith('http')
  const hadQueryString = value.includes('?')
  const redactedPath = isHttp ? '(url)' : redactObjectPath(value)
  return { present: true, isHttp, hadQueryString, redactedPath, length: value.length }
}

/**
 * Elimina de un texto cualquier aparición literal de los secretos de entorno conocidos (defensa
 * en profundidad para mensajes de error): DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_DB_URL, TEST_DATABASE_URL. No lee valores fuera de los provistos.
 */
export function redactSecretsInText(
  text: string,
  env: Record<string, string | undefined> = process.env
): string {
  const secretVars = [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'TEST_DATABASE_URL',
    'SUPABASE_SECRET_KEY',
  ]
  let out = text
  for (const name of secretVars) {
    const val = env[name]
    if (val && val.length >= 8) {
      out = out.split(val).join(`[REDACTED:${name}]`)
    }
  }
  return out
}
