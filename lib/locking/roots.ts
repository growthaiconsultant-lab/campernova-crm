/**
 * Orden global de adquisición de locks (PR I1).
 *
 * ÚNICA fuente de verdad del orden. Si el orden viviera repartido entre módulos, dos flujos
 * podrían adquirir las mismas filas en sentido inverso y provocar un deadlock; centralizarlo aquí
 * es lo que hace que la ausencia de inversión sea una propiedad del diseño y no una casualidad.
 *
 * Orden por tipo: Vehicle → SellerLead → BuyerLead. Dentro del mismo tipo, por `id` ascendente.
 * Justificación (flujos reales del CRM): las operaciones que tocan dos raíces —crear oferta,
 * aceptar reserva, crear o completar entrega— siempre implican un vehículo y un comprador, y
 * ninguna necesita el comprador antes que el vehículo. Archivar un vendedor toma {Vehicle,
 * SellerLead} y archivar un comprador toma {BuyerLead}: ambos son subconjuntos que respetan el
 * mismo orden.
 *
 * `INVALID ROOTS FAIL CLOSED` — una raíz inválida NO se descarta: aborta la llamada antes de abrir
 * ninguna transacción. Descartarla dejaría al llamante creyendo que pidió N locks cuando solo se
 * adquirieron N-1, que es justo la forma de debilitar un invariante sin que nadie se entere.
 *
 * `EMPTY ROOT SET IS EXPLICIT; INVALID ROOTS ARE REJECTED` — una lista vacía es una decisión
 * legítima del llamante; una lista no vacía nunca se convierte en vacía en silencio.
 */
import { LockError } from './errors'
import type { LockRoot, LockRootType } from './types'

/** Rango de cada tipo. Menor = se bloquea antes. */
export const ROOT_TYPE_RANK: Record<LockRootType, number> = {
  vehicle: 1,
  sellerLead: 2,
  buyerLead: 3,
}

/**
 * Identificadores físicos de tabla, ya entrecomillados. Mapping CERRADO: la tabla nunca procede
 * de una cadena del llamante, solo de este registro indexado por un tipo literal.
 */
export const ROOT_TABLES: Record<LockRootType, string> = {
  vehicle: '"vehicles"',
  sellerLead: '"seller_leads"',
  buyerLead: '"buyer_leads"',
}

/** Etiqueta legible; se usa en trazas internas, nunca en mensajes al usuario. */
export const ROOT_LABELS: Record<LockRootType, string> = {
  vehicle: 'vehículo',
  sellerLead: 'lead de vendedor',
  buyerLead: 'lead de comprador',
}

export function isLockRootType(value: unknown): value is LockRootType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROOT_TYPE_RANK, value)
}

/** Clave de identidad de una raíz; dos entradas con la misma clave son la misma fila. */
export function rootKey(root: LockRoot): string {
  return `${root.type}:${root.id}`
}

/**
 * Valida una raíz y devuelve su forma normalizada, o lanza `INVALID_LOCK_ROOT`.
 *
 * La validación es de RUNTIME a propósito: el contrato de TypeScript se puede eludir desde datos
 * deserializados, campos nullable del schema (`vehicle.sellerLeadId` es opcional), resultados
 * parciales y casts en server actions futuras. Confiar solo en el tipo dejaría el fail-open por la
 * puerta de atrás.
 *
 * No se valida el FORMATO del identificador: hoy el dominio usa `cuid()`, pero el helper no debe
 * acoplarse a esa elección; PostgreSQL ya rechaza cualquier id inexistente vía `ROOT_NOT_FOUND`.
 */
export function assertLockRoot(value: unknown): LockRoot {
  if (value === null || typeof value !== 'object') throw new LockError('INVALID_LOCK_ROOT')

  const { type, id } = value as { type?: unknown; id?: unknown }
  if (!isLockRootType(type)) throw new LockError('INVALID_LOCK_ROOT')
  if (typeof id !== 'string') throw new LockError('INVALID_LOCK_ROOT')

  const trimmed = id.trim()
  if (trimmed.length === 0) throw new LockError('INVALID_LOCK_ROOT')

  return { type, id: trimmed } as LockRoot
}

/**
 * Comparación lexicográfica por unidades de código: determinista e independiente del locale.
 *
 * `localeCompare` dependería de ICU y de la configuración del proceso, de modo que dos instancias
 * podrían ordenar distinto las mismas raíces — y órdenes distintos son exactamente la condición que
 * produce deadlocks. Los identificadores actuales son ASCII (`cuid`), pero la infraestructura no
 * debe depender de esa coincidencia.
 */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Valida, deduplica y ordena.
 *
 * - **Duplicado válido** → se colapsa en una sola adquisición, sin error.
 * - **Entrada inválida** → `INVALID_LOCK_ROOT`, sin ejecutar nada.
 *
 * El resultado es determinista y NO depende del orden de entrada: dos llamantes que pasen las
 * mismas raíces en distinto orden adquirirán los locks en la misma secuencia.
 */
export function normalizeRoots(roots: readonly LockRoot[]): LockRoot[] {
  if (!Array.isArray(roots)) throw new LockError('INVALID_LOCK_ROOT')

  const unique = new Map<string, LockRoot>()
  for (const raw of roots) {
    const root = assertLockRoot(raw)
    unique.set(rootKey(root), root)
  }

  return Array.from(unique.values()).sort((a, b) => {
    const byType = ROOT_TYPE_RANK[a.type] - ROOT_TYPE_RANK[b.type]
    return byType !== 0 ? byType : compareIds(a.id, b.id)
  })
}
