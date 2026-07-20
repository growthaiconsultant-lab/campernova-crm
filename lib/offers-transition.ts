/**
 * PR I2C — Transiciones coordinadas de oferta y reserva (núcleo transaccional).
 *
 * Las transiciones mueven a la vez la oferta, el stock del vehículo y el timeline de ambos lados.
 * Hasta ahora se decidían sobre una lectura previa fuera de transacción y sin coordinar con el
 * archivado de leads. Aquí todo ocurre dentro de la transacción abierta por `withLockedRoots`, con
 * las raíces bloqueadas en el orden global (Vehicle → SellerLead → BuyerLead).
 *
 * ## Propiedad de la reserva
 *
 * El modelo **no** tiene una columna que diga qué oferta reserva un vehículo. La propiedad se
 * **infiere** de este invariante, que este módulo hace cumplir:
 *
 *     PARA CADA VEHÍCULO: COMO MÁXIMO UNA OFFER CON status = ACEPTADA
 *
 * Mientras se cumpla, la única oferta `ACEPTADA` es la dueña de la reserva. El lock de `Vehicle`
 * serializa todas las aceptaciones y cancelaciones del mismo vehículo, y la comprobación se hace
 * **dentro** de la transacción y **después** de adquirir ese lock.
 *
 * ⚠️ `I3 MUST REMOVE MANUAL PUBLICADO ↔ RESERVADO TRANSITIONS FROM updateVehicle` — hoy
 * `updateVehicle` todavía permite mover el estado del vehículo a mano, así que podría fabricarse un
 * estado incoherente (dos ofertas `ACEPTADA`) por fuera de este dominio. Hasta que I3 lo cierre,
 * este módulo se **defiende** de esos estados fallando cerrado, sin repararlos automáticamente.
 *
 * `I2C COORDINATES OFFER STATUS TRANSITIONS`
 * `DELIVERY, VEHICLE AND VALUATION WRITERS REMAIN UNCOORDINATED UNTIL I3`
 */
import type { LostReason, OfferStatus, Prisma, VehicleStatus } from '@prisma/client'
import type { LockRoot } from '@/lib/locking'
import { OFFER_STATUS_LABELS, isValidOfferTransition } from '@/lib/offers'
import {
  applyOfferStatusChangeTx,
  shouldReleaseVehicle,
  shouldReserveVehicle,
} from './offers-reservation'

export type OfferTransitionErrorCode =
  | 'OFFER_NOT_FOUND'
  | 'VEHICLE_NOT_FOUND'
  | 'BUYER_LEAD_NOT_FOUND'
  | 'SELLER_LEAD_NOT_FOUND'
  | 'LEAD_ARCHIVED'
  | 'OFFER_ROOT_CHANGED'
  | 'INVALID_TRANSITION'
  | 'VEHICLE_NOT_AVAILABLE'
  | 'RESERVATION_ALREADY_OWNED'
  | 'RESERVATION_OWNERSHIP_CONFLICT'
  | 'VEHICLE_RESERVATION_STATE_CONFLICT'
  | 'VEHICLE_NOT_READY_FOR_CONVERSION'

/** Mensajes visibles: sin ids, sin estado interno, sin SQL, sin Prisma, sin PII. */
export const OFFER_TRANSITION_ERROR_MESSAGES: Record<OfferTransitionErrorCode, string> = {
  OFFER_NOT_FOUND: 'Oferta no encontrada',
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  BUYER_LEAD_NOT_FOUND: 'Comprador no encontrado',
  SELLER_LEAD_NOT_FOUND: 'No se ha encontrado el vendedor del vehículo',
  LEAD_ARCHIVED: 'No se puede modificar una oferta de un lead archivado. Reactívalo primero.',
  OFFER_ROOT_CHANGED:
    'Los datos de la oferta han cambiado mientras se procesaba. Inténtalo de nuevo.',
  INVALID_TRANSITION: 'La oferta ya no está en el estado esperado. Recarga e inténtalo de nuevo.',
  VEHICLE_NOT_AVAILABLE: 'El vehículo debe estar publicado para aceptar la oferta.',
  RESERVATION_ALREADY_OWNED:
    'El vehículo ya tiene otra oferta aceptada y no puede reservarse de nuevo.',
  RESERVATION_OWNERSHIP_CONFLICT:
    'No se puede cancelar la reserva porque el vehículo presenta otra oferta aceptada.',
  VEHICLE_RESERVATION_STATE_CONFLICT:
    'El estado del vehículo no permite completar esta operación. Revísalo antes de continuar.',
  VEHICLE_NOT_READY_FOR_CONVERSION:
    'El vehículo no se encuentra reservado y la oferta no puede convertirse en venta.',
}

/** Conflicto de negocio esperado al transicionar una oferta. No es un error técnico. */
export class OfferTransitionError extends Error {
  readonly code: OfferTransitionErrorCode

  constructor(code: OfferTransitionErrorCode) {
    super(OFFER_TRANSITION_ERROR_MESSAGES[code])
    this.name = 'OfferTransitionError'
    this.code = code
  }
}

export function isOfferTransitionError(err: unknown): err is OfferTransitionError {
  return err instanceof OfferTransitionError
}

/** Único estado del vehículo desde el que puede completarse una aceptación. */
export const OFFER_ACCEPTANCE_REQUIRED_VEHICLE_STATUS: VehicleStatus = 'PUBLICADO'

/**
 * Estados del vehículo compatibles con cancelar una oferta aceptada.
 * `RESERVADO`: se libera. `PUBLICADO`: la liberación ya ocurrió, se acepta sin tocar el vehículo.
 * Cualquier otro es incoherente y falla cerrado — nunca se fuerza el vehículo a `PUBLICADO`.
 */
export const CANCELLABLE_VEHICLE_STATUS_POLICY: Record<VehicleStatus, boolean> = {
  NUEVO: false,
  TASADO: false,
  PUBLICADO: true,
  RESERVADO: true,
  VENDIDO: false,
  DESCARTADO: false,
}

/**
 * Estados del vehículo compatibles con convertir una oferta aceptada en venta.
 *
 * Solo `RESERVADO`. Convertir cierra una venta y emite `SALE_CLOSED`: hacerlo sobre un vehículo
 * `PUBLICADO` (la reserva se deshizo por fuera), `VENDIDO`/`DESCARTADO` (el ciclo ya terminó) o
 * `NUEVO`/`TASADO` registraría un cierre sobre un estado operativo incoherente. La conversión **no**
 * modifica el vehículo: se limita a exigir que la reserva siga viva. Delivery/I3 lo llevará a
 * `VENDIDO` después.
 */
export const OFFER_CONVERSION_VEHICLE_STATUS_POLICY: Record<VehicleStatus, boolean> = {
  NUEVO: false,
  TASADO: false,
  PUBLICADO: false,
  RESERVADO: true,
  VENDIDO: false,
  DESCARTADO: false,
}

/**
 * Raíces a bloquear para transicionar una oferta. El vendedor solo si el vehículo lo tiene: nunca
 * se construye una raíz con id vacío. Vehículo y comprador son obligatorios en el modelo.
 */
export function buildOfferTransitionRoots(p: {
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

export type OfferTransitionParams = {
  offerId: string
  toStatus: OfferStatus
  /** Datos observados en la lectura preliminar; sirven para detectar que las raíces cambiaron. */
  resolvedVehicleId: string
  resolvedBuyerLeadId: string
  resolvedSellerLeadId: string | null
  depositAmount?: number | null
  reservedUntil?: Date | null
  rejectionReason?: LostReason | null
  finalAmount?: number | null
  actorId: string
}

export type OfferTransitionHooks = {
  /** Tras releer y validar, antes de cualquier escritura. */
  beforeWrite?: () => Promise<void>
  /** Entre el CAS de la oferta y el del vehículo (se delega al servicio de reserva). */
  beforeVehicleWrite?: () => Promise<void>
}

export type OfferTransitionResult = {
  fromStatus: OfferStatus
  toStatus: OfferStatus
  amount: number
  vehicleId: string
  buyerLeadId: string
  sellerLeadId: string | null
  reserved: boolean
  released: boolean
}

/** Cuenta otras ofertas ACEPTADA del mismo vehículo, excluyendo la actual. */
async function countOtherAcceptedOffers(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  offerId: string
): Promise<number> {
  return tx.offer.count({
    where: { vehicleId, status: 'ACEPTADA', id: { not: offerId } },
  })
}

/** Texto de la traza, con el mismo formato que ya se mostraba en el timeline. */
function buildActivityContent(p: {
  toStatus: OfferStatus
  depositAmount?: number | null
  rejectionReason?: LostReason | null
  brand: string
  model: string
}): string {
  const label = `Oferta ${OFFER_STATUS_LABELS[p.toStatus].toLowerCase()}`
  const detail =
    p.toStatus === 'ACEPTADA' && p.depositAmount
      ? `${label} · señal ${formatEur(p.depositAmount)}`
      : p.toStatus === 'RECHAZADA' && p.rejectionReason
        ? `${label} (${p.rejectionReason})`
        : label
  return `${detail} — ${p.brand} ${p.model}`
}

function formatEur(n: number): string {
  return n.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

/**
 * Aplica la transición dentro de una transacción con las raíces ya bloqueadas.
 *
 * Debe invocarse **dentro** de `withLockedRoots`; no abre transacción propia. Lanza
 * `OfferTransitionError` ante cualquier incumplimiento, lo que revierte todo lo escrito.
 * El CAS de `applyOfferStatusChangeTx` se **conserva** como segunda barrera: los locks coordinan
 * dominios, el CAS detecta que la expectativa del llamante quedó obsoleta.
 */
export async function applyOfferTransitionTx(
  tx: Prisma.TransactionClient,
  p: OfferTransitionParams,
  hooks: OfferTransitionHooks = {}
): Promise<OfferTransitionResult> {
  // (1) Relectura: la decisión se toma sobre estos datos, no sobre los de la lectura preliminar.
  const offer = await tx.offer.findUnique({
    where: { id: p.offerId },
    select: { id: true, status: true, amount: true, vehicleId: true, buyerLeadId: true },
  })
  if (!offer) throw new OfferTransitionError('OFFER_NOT_FOUND')

  // (2) Las raíces bloqueadas deben seguir siendo las correctas.
  if (offer.vehicleId !== p.resolvedVehicleId || offer.buyerLeadId !== p.resolvedBuyerLeadId) {
    throw new OfferTransitionError('OFFER_ROOT_CHANGED')
  }

  const vehicle = await tx.vehicle.findUnique({
    where: { id: offer.vehicleId },
    select: { id: true, status: true, sellerLeadId: true, brand: true, model: true },
  })
  if (!vehicle) throw new OfferTransitionError('VEHICLE_NOT_FOUND')
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new OfferTransitionError('OFFER_ROOT_CHANGED')
  }

  // (3) Leads activos. Sin excepciones: ninguna transición, ni siquiera terminal, sobre archivados.
  const buyer = await tx.buyerLead.findUnique({
    where: { id: offer.buyerLeadId },
    select: { id: true, archivedAt: true },
  })
  if (!buyer) throw new OfferTransitionError('BUYER_LEAD_NOT_FOUND')
  if (buyer.archivedAt != null) throw new OfferTransitionError('LEAD_ARCHIVED')

  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { id: true, archivedAt: true },
    })
    if (!seller) throw new OfferTransitionError('SELLER_LEAD_NOT_FOUND')
    if (seller.archivedAt != null) throw new OfferTransitionError('LEAD_ARCHIVED')
  }

  // (4) Máquina de estados, revalidada sobre el estado releído.
  const fromStatus = offer.status
  if (!isValidOfferTransition(fromStatus, p.toStatus)) {
    throw new OfferTransitionError('INVALID_TRANSITION')
  }

  // (5) Política por transición.
  if (p.toStatus === 'ACEPTADA') {
    if (vehicle.status !== OFFER_ACCEPTANCE_REQUIRED_VEHICLE_STATUS) {
      // Cubre TASADO (hay que publicar antes) y RESERVADO (la oferta es de respaldo).
      throw new OfferTransitionError('VEHICLE_NOT_AVAILABLE')
    }
    if ((await countOtherAcceptedOffers(tx, vehicle.id, offer.id)) > 0) {
      throw new OfferTransitionError('RESERVATION_ALREADY_OWNED')
    }
  }

  if (fromStatus === 'ACEPTADA' && (p.toStatus === 'CANCELADA' || p.toStatus === 'CONVERTIDA')) {
    // Propiedad inferible: si hay otra ACEPTADA no se puede saber de quién es la reserva.
    if ((await countOtherAcceptedOffers(tx, vehicle.id, offer.id)) > 0) {
      throw new OfferTransitionError('RESERVATION_OWNERSHIP_CONFLICT')
    }
  }

  if (fromStatus === 'ACEPTADA' && p.toStatus === 'CANCELADA') {
    if (!CANCELLABLE_VEHICLE_STATUS_POLICY[vehicle.status]) {
      throw new OfferTransitionError('VEHICLE_RESERVATION_STATE_CONFLICT')
    }
  }

  if (fromStatus === 'ACEPTADA' && p.toStatus === 'CONVERTIDA') {
    // Cerrar la venta exige que la reserva siga viva. `!== true` para fallar cerrado también ante
    // un `VehicleStatus` que la política no contemple en runtime.
    if (OFFER_CONVERSION_VEHICLE_STATUS_POLICY[vehicle.status] !== true) {
      throw new OfferTransitionError('VEHICLE_NOT_READY_FOR_CONVERSION')
    }
  }

  await hooks.beforeWrite?.()

  // (6) Escrituras. `release` solo si el vehículo sigue RESERVADO: si ya está PUBLICADO, la
  //     liberación se considera hecha y la cancelación procede sin tocar el vehículo.
  const reserve = shouldReserveVehicle(p.toStatus)
  const release = shouldReleaseVehicle(fromStatus, p.toStatus) && vehicle.status === 'RESERVADO'

  const { reserved, released } = await applyOfferStatusChangeTx(
    tx,
    {
      offerId: offer.id,
      fromStatus,
      toStatus: p.toStatus,
      offerData: {
        rejectionReason: p.toStatus === 'RECHAZADA' ? (p.rejectionReason ?? undefined) : undefined,
        depositAmount: p.toStatus === 'ACEPTADA' ? (p.depositAmount ?? undefined) : undefined,
        reservedUntil: p.toStatus === 'ACEPTADA' ? p.reservedUntil : undefined,
        amount: p.finalAmount ?? undefined,
      },
      vehicleId: vehicle.id,
      reserve,
      release,
      activityContent: buildActivityContent({
        toStatus: p.toStatus,
        depositAmount: p.depositAmount,
        rejectionReason: p.rejectionReason,
        brand: vehicle.brand,
        model: vehicle.model,
      }),
      actorId: p.actorId,
      buyerLeadId: offer.buyerLeadId,
      sellerLeadId: vehicle.sellerLeadId,
    },
    { beforeVehicleWrite: hooks.beforeVehicleWrite }
  )

  return {
    fromStatus,
    toStatus: p.toStatus,
    amount: Number(offer.amount),
    vehicleId: vehicle.id,
    buyerLeadId: offer.buyerLeadId,
    sellerLeadId: vehicle.sellerLeadId,
    reserved,
    released,
  }
}
