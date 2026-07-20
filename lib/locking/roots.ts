/**
 * Orden global de adquisición de locks (PR I1).
 *
 * ÚNICA fuente de verdad del orden. Si el orden viviera repartido entre módulos, dos flujos
 * podrían adquirir las mismas filas en sentido inverso y provocar un deadlock; centralizarlo aquí
 * es lo que hace que la ausencia de deadlock sea una propiedad del diseño y no una casualidad.
 *
 * Orden por tipo: Vehicle → SellerLead → BuyerLead. Dentro del mismo tipo, por `id` ascendente.
 * Justificación (flujos reales del CRM): las operaciones que tocan dos raíces —crear oferta,
 * aceptar reserva, crear o completar entrega— siempre implican un vehículo y un comprador, y
 * ninguna necesita el comprador antes que el vehículo. Archivar un vendedor toma {Vehicle,
 * SellerLead} y archivar un comprador toma {BuyerLead}: ambos son subconjuntos que respetan el
 * mismo orden, así que no existe ciclo posible.
 */
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
  return typeof value === 'string' && value in ROOT_TYPE_RANK
}

/** Clave de identidad de una raíz; dos entradas con la misma clave son la misma fila. */
export function rootKey(root: LockRoot): string {
  return `${root.type}:${root.id}`
}

/**
 * Deduplica y ordena. El resultado es determinista y NO depende del orden de entrada: dos
 * llamantes que pasen las mismas raíces en distinto orden adquirirán los locks en la misma
 * secuencia, que es la condición que evita el deadlock.
 *
 * Descarta entradas sin `id` (cadena vacía o espacios): una raíz sin identificador no es una fila.
 */
export function normalizeRoots(roots: readonly LockRoot[]): LockRoot[] {
  const unique = new Map<string, LockRoot>()

  for (const root of roots) {
    if (!isLockRootType(root?.type)) continue
    const id = typeof root.id === 'string' ? root.id.trim() : ''
    if (!id) continue
    const normalized = { type: root.type, id } as LockRoot
    const key = rootKey(normalized)
    if (!unique.has(key)) unique.set(key, normalized)
  }

  return Array.from(unique.values()).sort((a, b) => {
    const byType = ROOT_TYPE_RANK[a.type] - ROOT_TYPE_RANK[b.type]
    return byType !== 0 ? byType : a.id.localeCompare(b.id)
  })
}
