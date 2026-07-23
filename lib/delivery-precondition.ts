import type { Prisma } from '@prisma/client'

/**
 * PR I3C3 (corrección pre-merge) — Escrituras de PRECONDICIÓN de la entrega COORDINADAS.
 *
 * La compleción (`completeDeliveryTx`) valida checklist y firma BAJO el lock de raíces. Pero los dos
 * writers que producen esas precondiciones —edición de checklist y firma— hacían
 * `leer estado → comprobar → escribir` FUERA del protocolo, en statements separados y sin lock. Eso
 * dejaba una carrera real: un editor que leyó `EN_CURSO` antes del commit de la compleción podía
 * escribir DESPUÉS del terminal, dejando `Delivery COMPLETADA + checklist incompleto` (o firma
 * modificada tras el terminal).
 *
 * Esta corrección hace que AMBOS writers entren en el MISMO protocolo de raíces
 * (`Vehicle → SellerLead → BuyerLead`) vía `withLockedRoots`: releen la entrega BAJO el lock,
 * clasifican el estado terminal contra lo releído y solo escriben si sigue siendo editable, todo en la
 * misma transacción. Así la compleción y estas ediciones se serializan por los mismos row locks:
 *
 * `TERMINAL PRECONDITION WRITERS SERIALIZE WITH COMPLETION THROUGH THE ROOT LOCK PROTOCOL`
 *
 * No introduce migración, estados nuevos ni cambios en Warranty/Offer/Match/BuyerLead.
 */

export type DeliveryPreconditionErrorCode =
  | 'DELIVERY_NOT_FOUND'
  | 'DELIVERY_ROOT_CHANGED'
  | 'DELIVERY_ALREADY_COMPLETED'
  | 'DELIVERY_ALREADY_CANCELLED'
  | 'CHECKLIST_ITEM_NOT_FOUND'
  | 'CHECKLIST_ITEM_MISMATCH'
  | 'SIGNATURE_FORBIDDEN'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma ni PII. */
export const DELIVERY_PRECONDITION_ERROR_MESSAGES: Record<DeliveryPreconditionErrorCode, string> = {
  DELIVERY_NOT_FOUND: 'Entrega no encontrada',
  DELIVERY_ROOT_CHANGED:
    'Los datos de la entrega han cambiado mientras se procesaba. Inténtalo de nuevo.',
  DELIVERY_ALREADY_COMPLETED: 'No se puede editar el checklist de una entrega finalizada.',
  DELIVERY_ALREADY_CANCELLED: 'No se puede editar el checklist de una entrega finalizada.',
  CHECKLIST_ITEM_NOT_FOUND: 'Ítem de checklist no encontrado',
  CHECKLIST_ITEM_MISMATCH: 'El ítem no pertenece a esta entrega.',
  SIGNATURE_FORBIDDEN: 'Solo el responsable de la entrega o un admin puede firmar.',
}

export class DeliveryPreconditionError extends Error {
  readonly code: DeliveryPreconditionErrorCode
  constructor(code: DeliveryPreconditionErrorCode, message?: string) {
    super(message ?? DELIVERY_PRECONDITION_ERROR_MESSAGES[code])
    this.name = 'DeliveryPreconditionError'
    this.code = code
  }
}

export function isDeliveryPreconditionError(err: unknown): err is DeliveryPreconditionError {
  return err instanceof DeliveryPreconditionError
}

type ResolvedRoots = {
  deliveryId: string
  vehicleId: string
  buyerLeadId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta cambio de raíz bajo el lock. */
  resolvedSellerLeadId: string | null
}

/**
 * Relee la entrega BAJO el lock, valida coherencia de raíces y clasifica el estado terminal.
 * Lanza `DeliveryPreconditionError` (que revierte la transacción) si no es editable. Devuelve la
 * entrega releída (estado editable garantizado: ni COMPLETADA ni CANCELADA).
 */
async function readEditableDeliveryUnderLock(
  tx: Prisma.TransactionClient,
  roots: ResolvedRoots
): Promise<{ status: string; responsableId: string | null }> {
  const delivery = await tx.delivery.findUnique({
    where: { id: roots.deliveryId },
    select: { status: true, vehicleId: true, buyerLeadId: true, responsableId: true },
  })
  if (!delivery) throw new DeliveryPreconditionError('DELIVERY_NOT_FOUND')

  // Coherencia de raíces: la entrega sigue colgando del mismo vehículo y comprador...
  if (delivery.vehicleId !== roots.vehicleId || delivery.buyerLeadId !== roots.buyerLeadId) {
    throw new DeliveryPreconditionError('DELIVERY_ROOT_CHANGED')
  }
  // ...y el vehículo del mismo vendedor observado (el que se bloqueó).
  const vehicle = await tx.vehicle.findUnique({
    where: { id: roots.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle || vehicle.sellerLeadId !== roots.resolvedSellerLeadId) {
    throw new DeliveryPreconditionError('DELIVERY_ROOT_CHANGED')
  }

  // Clasificación del estado terminal contra la lectura BAJO lock (autoridad).
  if (delivery.status === 'COMPLETADA')
    throw new DeliveryPreconditionError('DELIVERY_ALREADY_COMPLETED')
  if (delivery.status === 'CANCELADA')
    throw new DeliveryPreconditionError('DELIVERY_ALREADY_CANCELLED')

  return { status: delivery.status, responsableId: delivery.responsableId }
}

export type UpdateChecklistItemParams = ResolvedRoots & {
  itemId: string
  result: 'PENDIENTE' | 'OK' | 'INCIDENCIA' | 'NO_APLICA'
  notes: string | null
}

/**
 * Actualiza un ítem de checklist de forma COORDINADA dentro de `tx` (debe correr dentro de
 * `withLockedRoots`). Relee la entrega y el ítem bajo el lock, valida terminal + pertenencia, y solo
 * entonces escribe. Cero mutaciones si cualquier validación falla.
 */
export async function updateChecklistItemTx(
  tx: Prisma.TransactionClient,
  p: UpdateChecklistItemParams
): Promise<void> {
  await readEditableDeliveryUnderLock(tx, p)

  // El ítem debe existir y pertenecer a ESTA entrega (releído bajo lock, no con la preliminar).
  const item = await tx.deliveryChecklistItem.findUnique({
    where: { id: p.itemId },
    select: { deliveryId: true },
  })
  if (!item) throw new DeliveryPreconditionError('CHECKLIST_ITEM_NOT_FOUND')
  if (item.deliveryId !== p.deliveryId) {
    throw new DeliveryPreconditionError('CHECKLIST_ITEM_MISMATCH')
  }

  await tx.deliveryChecklistItem.update({
    where: { id: p.itemId },
    data: { result: p.result, notes: p.notes },
  })
}

export type WriteSignatureParams = ResolvedRoots & {
  actorId: string
  actorIsAdmin: boolean
  signedByName: string
  signedByDni: string
  signatureUrl: string
}

/**
 * Escribe la firma de forma COORDINADA dentro de `tx` (debe correr dentro de `withLockedRoots`).
 * Relee la entrega bajo el lock, valida terminal + autorización del responsable, y solo entonces
 * escribe. Impide que una firma iniciada en EN_CURSO aterrice tras un estado terminal.
 */
export async function writeSignatureTx(
  tx: Prisma.TransactionClient,
  p: WriteSignatureParams
): Promise<void> {
  const delivery = await readEditableDeliveryUnderLock(tx, p)

  if (!p.actorIsAdmin && delivery.responsableId !== p.actorId) {
    throw new DeliveryPreconditionError('SIGNATURE_FORBIDDEN')
  }

  await tx.delivery.update({
    where: { id: p.deliveryId },
    data: {
      signedByName: p.signedByName,
      signedByDni: p.signedByDni,
      signatureUrl: p.signatureUrl,
    },
  })
}
