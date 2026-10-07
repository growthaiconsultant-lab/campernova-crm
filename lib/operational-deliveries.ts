import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { createWarrantyForDelivery } from './postventa'
import { canManageOperationalDeliveries } from './operations-policy'
import type { ManualDeliveryInput } from './operations-input'
import { normalizePhone, phonesMatch } from './phone'
import { defaultNextActionData } from './next-action'
import { suggestTemperatureFromTimeline } from './lead-temperature'
import { KPI_EVENTS } from './kpi/events'

export class OperationalError extends Error {}
export function operationFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function creationIdentity(actorId: string, input: ManualDeliveryInput) {
  return { key: `${actorId}:${input.operationId}`, fingerprint: operationFingerprint(input) }
}
async function createDeliveryBuyer(
  tx: Prisma.TransactionClient,
  buyer: Extract<ManualDeliveryInput['recipient'], { type: 'newBuyer' }>,
  actorId: string
) {
  // Hashes evitan exponer contactos en consultas/locks. Orden fijo evita ciclos entre altas.
  const contacts = [`email:${buyer.email.toLowerCase()}`, `phone:${normalizePhone(buyer.phone)}`]
    .map((contact) => `delivery-buyer:${operationFingerprint(contact)}`)
    .sort()
  for (const contact of contacts) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${contact}, 0))`
  }
  const existing = await tx.buyerLead.findMany({
    select: { email: true, phone: true },
  })
  if (
    existing.some(
      (row) =>
        row.email.trim().toLowerCase() === buyer.email.toLowerCase() ||
        phonesMatch(row.phone, buyer.phone)
    )
  ) {
    throw new OperationalError(
      'Ya existe una ficha con ese email o teléfono. Elige «Comprador existente» y búscala por su nombre.'
    )
  }
  const created = await tx.buyerLead.create({
    data: {
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      status: 'NUEVO',
      temperature: suggestTemperatureFromTimeline(null),
      ...defaultNextActionData(),
    },
    select: { id: true },
  })
  await tx.kpiEvent.create({
    data: {
      eventName: KPI_EVENTS.BUYER_CREATED,
      entityType: 'buyer',
      entityId: created.id,
      actorUserId: actorId,
      source: 'ui',
      metadata: {},
    },
  })
  return created
}
async function assertActor(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { role: true, active: true },
  })
  if (!actor || !canManageOperationalDeliveries(actor))
    throw new OperationalError('No tienes permiso para gestionar entregas.')
}
async function assertSaleAvailable(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  buyerId: string
) {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { status: true, soldAt: true },
  })
  if (!vehicle) throw new OperationalError('Vehículo no encontrado.')
  if (vehicle.status === 'VENDIDO' || vehicle.soldAt)
    throw new OperationalError('Este vehículo ya tiene una venta registrada. No se duplicará.')
  const warranty = await tx.warranty.count({
    where: { OR: [{ vehicleId }, { buyerLeadId: buyerId }] },
  })
  if (warranty)
    throw new OperationalError(
      'Ya existe una garantía vinculada a este vehículo o comprador. Revisa la venta existente.'
    )
  const conflict = await tx.offer.count({
    where: {
      vehicleId,
      buyerLeadId: { not: buyerId },
      OR: [{ status: 'CONVERTIDA' }, { status: 'ACEPTADA', depositAmount: { gt: 0 } }],
    },
  })
  if (conflict)
    throw new OperationalError(
      'Hay un compromiso económico con otro comprador. Debe resolverse antes de registrar la venta.'
    )
  return vehicle
}

/** Sólo dentro de withLockedRoots: vehículo, propietario y destinatario. */
export async function createOperationalDeliveryTx(
  tx: Prisma.TransactionClient,
  input: ManualDeliveryInput,
  actorId: string,
  sellerLeadId: string | null,
  hooks: { afterNewBuyerCreated?: () => Promise<void> } = {}
) {
  await assertActor(tx, actorId)
  const { key, fingerprint } = creationIdentity(actorId, input)
  const previous = await tx.delivery.findUnique({
    where: { creationKey: key },
    select: { id: true, creationFingerprint: true },
  })
  if (previous) {
    if (previous.creationFingerprint !== fingerprint)
      throw new OperationalError(
        'La solicitud ya fue utilizada con otros datos. Inicia una nueva entrega.'
      )
    return { id: previous.id, replayed: true }
  }
  const vehicle = await tx.vehicle.findUnique({
    where: { id: input.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle || vehicle.sellerLeadId !== sellerLeadId)
    throw new OperationalError('El vehículo ha cambiado. Recarga antes de continuar.')
  if (input.responsableId) {
    const responsible = await tx.user.findUnique({
      where: { id: input.responsableId },
      select: { active: true, role: true },
    })
    if (!responsible || !canManageOperationalDeliveries(responsible))
      throw new OperationalError('Selecciona un responsable activo con permisos de entregas.')
  }
  if (
    await tx.delivery.count({
      where: { vehicleId: input.vehicleId, status: { in: ['PROGRAMADA', 'EN_CURSO'] } },
    })
  ) {
    throw new OperationalError(
      'El vehículo ya tiene una entrega activa. Abre esa entrega para continuar.'
    )
  }
  const recipient =
    input.recipient.type === 'newBuyer'
      ? await createDeliveryBuyer(tx, input.recipient, actorId)
      : input.recipient.type === 'buyerLead'
        ? await tx.buyerLead.findUnique({ where: { id: input.recipient.id }, select: { id: true } })
        : await tx.sellerLead.findUnique({
            where: { id: input.recipient.id },
            select: { id: true },
          })
  if (!recipient) throw new OperationalError('Destinatario no encontrado.')
  if (input.recipient.type === 'newBuyer') await hooks.afterNewBuyerCreated?.()
  const buyerLeadId = input.recipient.type !== 'sellerLead' ? recipient.id : null
  const recipientSellerLeadId = input.recipient.type === 'sellerLead' ? recipient.id : null
  if (input.kind === 'VENTA') await assertSaleAvailable(tx, input.vehicleId, recipient.id)
  const delivery = await tx.delivery.create({
    data: {
      creationKey: key,
      creationFingerprint: fingerprint,
      kind: input.kind,
      vehicleId: input.vehicleId,
      buyerLeadId,
      recipientSellerLeadId,
      scheduledAt: new Date(input.scheduledAt),
      responsableId: input.responsableId,
      notes: input.notes,
      checklist: {
        create: [
          {
            category: 'PRE_ENTREGA',
            item: 'Revisión y preparación (opcional)',
            result: 'PENDIENTE',
          },
          {
            category: 'FIRMA_SALIDA',
            item: 'Documentación de salida (opcional)',
            result: 'PENDIENTE',
          },
        ],
      },
    },
    select: { id: true },
  })
  await tx.activity.create({
    data: {
      type: 'ENTREGA_PROGRAMADA',
      content: `Entrega manual: ${input.kind}.`,
      agentId: actorId,
      sellerLeadId: recipientSellerLeadId ?? sellerLeadId,
      buyerLeadId,
    },
  })
  return { id: delivery.id, replayed: false }
}

export type DeliveryRootsSnapshot = {
  id: string
  vehicleId: string
  buyerLeadId: string | null
  recipientSellerLeadId: string | null
  sellerLeadId: string | null
}
/** Un solo núcleo para entregas nuevas e históricas. Sin requisitos comerciales de flujo. */
export async function changeOperationalDeliveryTx(
  tx: Prisma.TransactionClient,
  roots: DeliveryRootsSnapshot,
  actorId: string,
  target: 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA',
  now: Date,
  reason?: string,
  hooks: { beforeWarranty?: () => Promise<void>; beforeFollowups?: () => Promise<void> } = {}
) {
  await assertActor(tx, actorId)
  const delivery = await tx.delivery.findUnique({
    where: { id: roots.id },
    select: {
      vehicleId: true,
      buyerLeadId: true,
      recipientSellerLeadId: true,
      kind: true,
      status: true,
      offerId: true,
      warranty: { select: { id: true } },
      vehicle: { select: { sellerLeadId: true } },
    },
  })
  if (!delivery) throw new OperationalError('Entrega no encontrada.')
  if (
    delivery.vehicleId !== roots.vehicleId ||
    delivery.buyerLeadId !== roots.buyerLeadId ||
    delivery.recipientSellerLeadId !== roots.recipientSellerLeadId ||
    delivery.vehicle.sellerLeadId !== roots.sellerLeadId
  ) {
    throw new OperationalError('Los datos han cambiado. Recarga la entrega.')
  }
  if (delivery.status === target)
    return { replayed: true, warrantyId: delivery.warranty?.id ?? null }
  if (delivery.status === 'COMPLETADA' || delivery.status === 'CANCELADA')
    throw new OperationalError('La entrega ya está cerrada.')
  if (target === 'CANCELADA' && !reason?.trim())
    throw new OperationalError('Indica el motivo de cancelación.')
  const sale = target === 'COMPLETADA' && delivery.kind === 'VENTA'
  if (sale) {
    if (!delivery.buyerLeadId)
      throw new OperationalError('La venta requiere un comprador identificado.')
    await assertSaleAvailable(tx, roots.vehicleId, delivery.buyerLeadId)
    if (delivery.offerId) {
      const offer = await tx.offer.findUnique({
        where: { id: delivery.offerId },
        select: { vehicleId: true, buyerLeadId: true },
      })
      if (
        !offer ||
        offer.vehicleId !== roots.vehicleId ||
        offer.buyerLeadId !== delivery.buyerLeadId
      )
        throw new OperationalError('La oferta vinculada no corresponde a esta venta.')
    }
  }
  const changed = await tx.delivery.updateMany({
    where: { id: roots.id, status: delivery.status },
    data: {
      status: target,
      ...(target === 'COMPLETADA' ? { completedAt: now } : {}),
      ...(target === 'EN_CURSO' ? { startedAt: now } : {}),
      ...(target === 'CANCELADA' ? { cancellationReason: reason!.trim() } : {}),
    },
  })
  if (changed.count !== 1)
    throw new OperationalError(
      'La entrega cambió mientras se guardaba. Recarga para comprobar su estado.'
    )
  let warrantyId: string | null = null
  if (sale && delivery.buyerLeadId) {
    const vehicle = await tx.vehicle.updateMany({
      where: { id: roots.vehicleId, soldAt: null, status: { not: 'VENDIDO' } },
      data: { status: 'VENDIDO', soldAt: now },
    })
    if (vehicle.count !== 1)
      throw new OperationalError('La venta ya se registró o el vehículo cambió.')
    await tx.buyerLead.update({ where: { id: delivery.buyerLeadId }, data: { status: 'CERRADO' } })
    await tx.match.updateMany({
      where: { vehicleId: roots.vehicleId, buyerLeadId: delivery.buyerLeadId, status: 'OFERTA' },
      data: { status: 'CERRADO' },
    })
    await hooks.beforeWarranty?.()
    warrantyId = (
      await createWarrantyForDelivery(roots.id, tx, { beforeFollowupsWrite: hooks.beforeFollowups })
    ).warrantyId
    await tx.activity.create({
      data: {
        type: 'GARANTIA_ACTIVADA',
        content: 'Venta registrada y garantía activada al completar entrega.',
        agentId: actorId,
        buyerLeadId: delivery.buyerLeadId,
        sellerLeadId: roots.sellerLeadId,
      },
    })
  }
  await tx.activity.create({
    data: {
      type:
        target === 'COMPLETADA'
          ? 'ENTREGA_COMPLETADA'
          : target === 'CANCELADA'
            ? 'ENTREGA_CANCELADA'
            : 'CAMBIO_ESTADO',
      content: `Entrega ${delivery.kind}: ${target}.`,
      agentId: actorId,
      buyerLeadId: delivery.buyerLeadId,
      sellerLeadId: delivery.recipientSellerLeadId ?? roots.sellerLeadId,
    },
  })
  return { replayed: false, warrantyId }
}
