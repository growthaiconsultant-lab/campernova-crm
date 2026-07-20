/**
 * PR I2B — Creación coordinada de ofertas (núcleo transaccional).
 *
 * Crear una oferta toca tres entidades a la vez: el vehículo, su vendedor y el comprador. Hasta
 * ahora se leían fuera de transacción y se escribía sin coordinación, de modo que un archivado
 * concurrente de cualquiera de los dos leads podía cruzarse con el alta y dejar un lead archivado
 * con una oferta viva.
 *
 * Aquí se resuelve dentro de la transacción abierta por `withLockedRoots`, con las raíces ya
 * bloqueadas en el orden global (Vehicle → SellerLead → BuyerLead):
 *   1. se relee todo — la lectura previa del llamante solo sirvió para descubrir las raíces;
 *   2. se comprueba que el vehículo sigue colgando del mismo vendedor que se bloqueó;
 *   3. se comprueba que ningún lead implicado está archivado;
 *   4. se comprueba que el estado del vehículo admite negociación;
 *   5. se crean `Offer` y `Activity` de forma **atómica**.
 *
 * `I2B COORDINATES OFFER CREATION ONLY`
 * `OFFER STATUS TRANSITIONS REMAIN UNCOORDINATED UNTIL I2C`
 *
 * Los efectos externos (KPI, revalidación de caché) son responsabilidad del llamante y ocurren
 * **después** del commit: dentro alargarían la retención de los locks.
 */
import type { Prisma, VehicleStatus } from '@prisma/client'
import type { LockRoot } from '@/lib/locking'

/**
 * Política por estado del vehículo para registrar una oferta nueva. Regla explícita y centralizada:
 * no se deduce por exclusión ni se reparte entre llamantes.
 *
 * Es un `Record<VehicleStatus, boolean>` **exhaustivo** a propósito: añadir un valor al enum
 * `VehicleStatus` rompe la compilación hasta que alguien declare si permite crear ofertas. Un array
 * de estados permitidos no daría esa garantía — el nuevo estado quedaría fuera en silencio.
 *
 * - `TASADO`: se permite empezar a negociar antes de la publicación formal.
 * - `PUBLICADO`: caso operativo normal.
 * - `RESERVADO`: se admite una oferta de respaldo. Crear no reserva nada —la oferta nace en
 *   `PROPUESTA`—, así que no genera una segunda reserva, no toca `Vehicle.status`, no inmoviliza
 *   stock adicional y no desplaza a la oferta aceptada.
 *
 * Quedan fuera `NUEVO` (todavía no preparado para negociación), `VENDIDO` (el activo ya no está
 * disponible) y `DESCARTADO` (fuera del circuito comercial).
 *
 * ⚠️ La ACEPTACIÓN sigue gobernada por el CAS vigente, que exige `PUBLICADO`: una oferta creada
 * sobre `TASADO` o `RESERVADO` no podrá aceptarse mientras el vehículo no esté publicado y libre.
 * Revisar esa coherencia corresponde a **I2C**; I2B no la toca.
 */
export const OFFER_CREATION_VEHICLE_STATUS_POLICY: Record<VehicleStatus, boolean> = {
  NUEVO: false,
  TASADO: true,
  PUBLICADO: true,
  RESERVADO: true,
  VENDIDO: false,
  DESCARTADO: false,
}

/**
 * Lista derivada, para los consumidores que necesiten enumerar los estados admitidos. **No** es
 * una segunda fuente de verdad: se calcula de la política, así que no puede desincronizarse.
 */
export const OFFER_CREATION_ALLOWED_VEHICLE_STATUSES: VehicleStatus[] = (
  Object.keys(OFFER_CREATION_VEHICLE_STATUS_POLICY) as VehicleStatus[]
).filter((status) => OFFER_CREATION_VEHICLE_STATUS_POLICY[status])

/**
 * Fail-closed también en runtime: un valor que no esté en la política —por ejemplo un dato no
 * tipado procedente de la base— se rechaza en lugar de colarse por ausencia de regla.
 */
export function canCreateOfferForVehicleStatus(status: VehicleStatus): boolean {
  return OFFER_CREATION_VEHICLE_STATUS_POLICY[status] === true
}

export type OfferCreationErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'BUYER_LEAD_NOT_FOUND'
  | 'SELLER_LEAD_NOT_FOUND'
  | 'LEAD_ARCHIVED'
  | 'OFFER_ROOT_CHANGED'
  | 'VEHICLE_NOT_AVAILABLE'

/** Mensajes visibles: sin ids, sin estado interno, sin SQL, sin Prisma, sin PII. */
export const OFFER_CREATION_ERROR_MESSAGES: Record<OfferCreationErrorCode, string> = {
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  BUYER_LEAD_NOT_FOUND: 'Comprador no encontrado',
  SELLER_LEAD_NOT_FOUND: 'No se ha encontrado el vendedor del vehículo',
  LEAD_ARCHIVED: 'No se puede registrar una oferta sobre un lead archivado. Reactívalo primero.',
  OFFER_ROOT_CHANGED:
    'Los datos del vehículo han cambiado mientras se registraba la oferta. Inténtalo de nuevo.',
  VEHICLE_NOT_AVAILABLE: 'El vehículo no está disponible para registrar una nueva oferta.',
}

/** Conflicto de negocio esperado al crear una oferta. No es un error técnico. */
export class OfferCreationError extends Error {
  readonly code: OfferCreationErrorCode

  constructor(code: OfferCreationErrorCode) {
    super(OFFER_CREATION_ERROR_MESSAGES[code])
    this.name = 'OfferCreationError'
    this.code = code
  }
}

export function isOfferCreationError(err: unknown): err is OfferCreationError {
  return err instanceof OfferCreationError
}

/**
 * Raíces a bloquear para crear una oferta, en el orden que impone `lib/locking`.
 *
 * `Vehicle.sellerLeadId` es nullable, así que el vendedor **solo** se incluye si existe: construir
 * `{ sellerLead, '' }` haría fallar el helper (fail-closed) o, peor con otro diseño, pediría un
 * lock de menos. El vehículo y el comprador son obligatorios en el modelo, de modo que la lista
 * nunca queda vacía.
 */
export function buildOfferCreationRoots(p: {
  vehicleId: string
  sellerLeadId: string | null
  buyerLeadId: string
}): LockRoot[] {
  return [
    { type: 'vehicle', id: p.vehicleId },
    ...(p.sellerLeadId ? ([{ type: 'sellerLead', id: p.sellerLeadId }] as LockRoot[]) : []),
    { type: 'buyerLead', id: p.buyerLeadId },
  ]
}

export type CreateOfferTxParams = {
  vehicleId: string
  buyerLeadId: string
  /** Vendedor observado en la lectura preliminar; se usa para detectar que la raíz cambió. */
  resolvedSellerLeadId: string | null
  matchId: string | null
  amount: number
  notes: string | null
  actorId: string
}

/** Semilla de test para forzar solapamiento real de transacciones (sin efecto en producción). */
export type CreateOfferTxHooks = {
  /** Se ejecuta tras releer y validar, justo antes de escribir la oferta. */
  beforeOfferWrite?: () => Promise<void>
  /** Se ejecuta entre la creación de la oferta y la de su traza. */
  beforeActivityWrite?: () => Promise<void>
}

export type CreateOfferTxResult = {
  offerId: string
  buyerName: string
  vehicleLabel: string
  sellerLeadId: string | null
}

/**
 * Crea la oferta dentro de una transacción con las raíces ya bloqueadas.
 *
 * Debe invocarse **dentro** de `withLockedRoots`; no abre transacción propia. Lanza
 * `OfferCreationError` ante cualquier incumplimiento, lo que revierte todo lo escrito.
 */
export async function createOfferTx(
  tx: Prisma.TransactionClient,
  p: CreateOfferTxParams,
  hooks: CreateOfferTxHooks = {}
): Promise<CreateOfferTxResult> {
  // (1) Relectura del vehículo: la decisión comercial se toma sobre estos datos, no sobre los que
  //     el llamante leyó fuera de la transacción.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { id: true, status: true, sellerLeadId: true, brand: true, model: true },
  })
  if (!vehicle) throw new OfferCreationError('VEHICLE_NOT_FOUND')

  // (2) La raíz bloqueada debe seguir siendo la correcta. Si el vehículo cambió de vendedor entre
  //     la resolución y la relectura, las raíces adquiridas ya no cubren la operación: se aborta,
  //     no se reconstruyen dentro de la transacción.
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new OfferCreationError('OFFER_ROOT_CHANGED')
  }

  // (3) Estado admitido para negociar.
  if (!canCreateOfferForVehicleStatus(vehicle.status)) {
    throw new OfferCreationError('VEHICLE_NOT_AVAILABLE')
  }

  // (4) Comprador activo.
  const buyer = await tx.buyerLead.findUnique({
    where: { id: p.buyerLeadId },
    select: { id: true, name: true, archivedAt: true },
  })
  if (!buyer) throw new OfferCreationError('BUYER_LEAD_NOT_FOUND')
  if (buyer.archivedAt != null) throw new OfferCreationError('LEAD_ARCHIVED')

  // (5) Vendedor activo, si el vehículo tiene uno.
  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { id: true, archivedAt: true },
    })
    if (!seller) throw new OfferCreationError('SELLER_LEAD_NOT_FOUND')
    if (seller.archivedAt != null) throw new OfferCreationError('LEAD_ARCHIVED')
  }

  await hooks.beforeOfferWrite?.()

  // (6) Oferta y traza, atómicas: si la Activity falla, la oferta revierte con ella.
  const offer = await tx.offer.create({
    data: {
      vehicleId: p.vehicleId,
      buyerLeadId: p.buyerLeadId,
      matchId: p.matchId,
      amount: p.amount,
      notes: p.notes,
      createdById: p.actorId,
    },
    select: { id: true },
  })

  await hooks.beforeActivityWrite?.()

  const content = `Oferta registrada: ${formatEur(p.amount)} — ${buyer.name} por ${vehicle.brand} ${vehicle.model}`
  await tx.activity.createMany({
    data: [
      { type: 'OFERTA_REGISTRADA', content, agentId: p.actorId, buyerLeadId: buyer.id },
      ...(vehicle.sellerLeadId
        ? [
            {
              type: 'OFERTA_REGISTRADA' as const,
              content,
              agentId: p.actorId,
              sellerLeadId: vehicle.sellerLeadId,
            },
          ]
        : []),
    ],
  })

  return {
    offerId: offer.id,
    buyerName: buyer.name,
    vehicleLabel: `${vehicle.brand} ${vehicle.model}`,
    sellerLeadId: vehicle.sellerLeadId,
  }
}

/**
 * Formato idéntico al que ya usaba la acción (`EUR` en `ofertas/actions.ts`), para que el texto
 * de las Activities no cambie ni un carácter.
 */
function formatEur(n: number): string {
  return n.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}
