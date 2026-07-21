/**
 * PR I3C1A — Creación coordinada de Delivery (núcleo transaccional).
 *
 * Antes `createDelivery` insertaba sin transacción, sin locks, con permiso de lectura y sin validar
 * Offer, estado del vehículo ni unicidad. Aquí la creación ocurre dentro de la transacción abierta
 * por `withLockedRoots` (Vehicle → SellerLead → BuyerLead), relee todo dentro, exige una Offer
 * `CONVERTIDA` coherente + Vehicle `RESERVADO`, impide una segunda Delivery activa o recrear tras una
 * completada, y persiste `offerId`.
 *
 * `I3C1A ADDS AN OPTIONAL DELIVERY OFFER LINK FOR EXPAND–CONTRACT COMPATIBILITY`
 * `NEW DELIVERY WRITERS MUST ALWAYS PERSIST offerId`
 * `AT MOST ONE PROGRAMADA OR EN_CURSO DELIVERY IS ALLOWED PER VEHICLE`
 *
 * La columna `offer_id` es físicamente nullable solo durante expand–contract (I3C1B la hará NOT
 * NULL). **Este escritor nunca crea una Delivery sin `offerId`**: la opcionalidad existe para que el
 * código antiguo sobreviva al rollout, no como contrato de aplicación.
 *
 * `DELIVERY COMPLETION REMAINS UNCOORDINATED UNTIL I3C3`
 */
import type { DeliveryChecklistCategory, DeliveryStatus, Prisma } from '@prisma/client'
import type { LockRoot } from '@/lib/locking'

export type DeliveryCreationErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'OFFER_NOT_FOUND'
  | 'BUYER_LEAD_NOT_FOUND'
  | 'SELLER_LEAD_NOT_FOUND'
  | 'LEAD_ARCHIVED'
  | 'DELIVERY_ROOT_CHANGED'
  | 'OFFER_NOT_CONVERTED'
  | 'OFFER_MISMATCH'
  | 'VEHICLE_NOT_READY_FOR_DELIVERY'
  | 'DELIVERY_ALREADY_ACTIVE'
  | 'VEHICLE_ALREADY_DELIVERED'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma, stack, cause ni PII. */
export const DELIVERY_CREATION_ERROR_MESSAGES: Record<DeliveryCreationErrorCode, string> = {
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  OFFER_NOT_FOUND: 'Oferta no encontrada',
  BUYER_LEAD_NOT_FOUND: 'Comprador no encontrado',
  SELLER_LEAD_NOT_FOUND: 'No se ha encontrado el vendedor del vehículo',
  LEAD_ARCHIVED: 'No se puede crear una entrega para un lead archivado. Reactívalo primero.',
  DELIVERY_ROOT_CHANGED:
    'Los datos de la entrega han cambiado mientras se procesaba. Inténtalo de nuevo.',
  OFFER_NOT_CONVERTED: 'La oferta debe estar convertida en venta antes de programar la entrega.',
  OFFER_MISMATCH: 'La oferta no corresponde a este vehículo y comprador.',
  VEHICLE_NOT_READY_FOR_DELIVERY: 'El vehículo debe estar reservado para programar la entrega.',
  DELIVERY_ALREADY_ACTIVE: 'El vehículo ya tiene una entrega activa.',
  VEHICLE_ALREADY_DELIVERED: 'El vehículo ya tiene una entrega completada.',
}

/** Conflicto de negocio esperado al crear una entrega. No es un error técnico. */
export class DeliveryCreationError extends Error {
  readonly code: DeliveryCreationErrorCode
  constructor(code: DeliveryCreationErrorCode) {
    super(DELIVERY_CREATION_ERROR_MESSAGES[code])
    this.name = 'DeliveryCreationError'
    this.code = code
  }
}

export function isDeliveryCreationError(err: unknown): err is DeliveryCreationError {
  return err instanceof DeliveryCreationError
}

/** Estados en los que una Delivery ocupa el vehículo. Solo una activa por vehículo. */
export const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = ['PROGRAMADA', 'EN_CURSO']

/** Nombre del índice único parcial (segunda barrera de unicidad en BD). */
export const ACTIVE_DELIVERY_UNIQUE_INDEX = 'deliveries_active_vehicle_key'

/**
 * Raíces a bloquear para crear una entrega: `Vehicle → SellerLead → BuyerLead`. El vendedor solo si
 * el vehículo lo tiene; nunca una raíz con id vacío. El orden global lo fija `withLockedRoots`.
 */
export function buildDeliveryCreationRoots(p: {
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

export type CreateDeliveryParams = {
  vehicleId: string
  buyerLeadId: string
  offerId: string
  /** `sellerLeadId` observado en la lectura preliminar; sirve para detectar que la raíz cambió. */
  resolvedSellerLeadId: string | null
  scheduledAt: Date
  responsableId: string | null
  notes: string | null
  actorId: string
  /** Ítems del checklist inicial. */
  checklist: Array<{ category: DeliveryChecklistCategory; item: string }>
}

export type CreateDeliveryHooks = {
  /** Sincronización determinista para tests de concurrencia (antes del insert). */
  beforeWrite?: () => Promise<void>
}

/**
 * Crea la entrega + su traza dentro de la transacción abierta por `withLockedRoots`, tras releer y
 * validar Offer/Vehicle/leads. Debe invocarse dentro de `withLockedRoots(...)`.
 */
export async function createDeliveryTx(
  tx: Prisma.TransactionClient,
  p: CreateDeliveryParams,
  hooks: CreateDeliveryHooks = {}
): Promise<{ deliveryId: string }> {
  // (1) Relectura del vehículo y consistencia de raíz.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { status: true, sellerLeadId: true },
  })
  if (!vehicle) throw new DeliveryCreationError('VEHICLE_NOT_FOUND')
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new DeliveryCreationError('DELIVERY_ROOT_CHANGED')
  }

  // (2) Vendedor (si existe) y comprador: existen y activos.
  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { archivedAt: true },
    })
    if (!seller) throw new DeliveryCreationError('SELLER_LEAD_NOT_FOUND')
    if (seller.archivedAt != null) throw new DeliveryCreationError('LEAD_ARCHIVED')
  }
  const buyer = await tx.buyerLead.findUnique({
    where: { id: p.buyerLeadId },
    select: { archivedAt: true },
  })
  if (!buyer) throw new DeliveryCreationError('BUYER_LEAD_NOT_FOUND')
  if (buyer.archivedAt != null) throw new DeliveryCreationError('LEAD_ARCHIVED')

  // (3) Oferta: existe, CONVERTIDA y coherente con vehículo + comprador.
  const offer = await tx.offer.findUnique({
    where: { id: p.offerId },
    select: { status: true, vehicleId: true, buyerLeadId: true },
  })
  if (!offer) throw new DeliveryCreationError('OFFER_NOT_FOUND')
  if (offer.vehicleId !== p.vehicleId || offer.buyerLeadId !== p.buyerLeadId) {
    throw new DeliveryCreationError('OFFER_MISMATCH')
  }
  if (offer.status !== 'CONVERTIDA') throw new DeliveryCreationError('OFFER_NOT_CONVERTED')

  // (4) Estado del vehículo: exactamente RESERVADO.
  if (vehicle.status !== 'RESERVADO') {
    throw new DeliveryCreationError('VEHICLE_NOT_READY_FOR_DELIVERY')
  }

  // (5) Unicidad: sin otra Delivery activa; y no recrear tras una completada.
  const active = await tx.delivery.count({
    where: { vehicleId: p.vehicleId, status: { in: ACTIVE_DELIVERY_STATUSES } },
  })
  if (active > 0) throw new DeliveryCreationError('DELIVERY_ALREADY_ACTIVE')
  const completed = await tx.delivery.count({
    where: { vehicleId: p.vehicleId, status: 'COMPLETADA' },
  })
  if (completed > 0) throw new DeliveryCreationError('VEHICLE_ALREADY_DELIVERED')

  await hooks.beforeWrite?.()

  // (6) Escritura: Delivery (con offerId) + Activity, en la misma transacción.
  const delivery = await tx.delivery.create({
    data: {
      vehicleId: p.vehicleId,
      buyerLeadId: p.buyerLeadId,
      offerId: p.offerId,
      responsableId: p.responsableId,
      scheduledAt: p.scheduledAt,
      notes: p.notes,
      checklist: {
        create: p.checklist.map((c) => ({ ...c, result: 'PENDIENTE' as const })),
      },
    },
    select: { id: true },
  })

  await tx.activity.create({
    data: {
      type: 'ENTREGA_PROGRAMADA',
      content: `Entrega programada para el ${p.scheduledAt.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}`,
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
      buyerLeadId: p.buyerLeadId,
    },
  })

  return { deliveryId: delivery.id }
}
