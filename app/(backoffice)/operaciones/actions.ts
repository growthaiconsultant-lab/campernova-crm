'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { operationalWritesPaused, OPS1_PAUSED_MESSAGE } from '@/lib/operations-control'
import { OPERATIONAL_DELIVERY_ROLES } from '@/lib/operations-policy'
import {
  manualDeliverySchema,
  manualDeliveryValidationMessage,
  operationalSearchSchema,
} from '@/lib/operations-input'
import { buildDeliveryCreationRoots } from '@/lib/delivery-creation'
import { withLockedRoots, isLockError } from '@/lib/locking'
import {
  createOperationalDeliveryTx,
  changeOperationalDeliveryTx,
  creationIdentity,
  OperationalError,
} from '@/lib/operational-deliveries'

function safeFailure(error: unknown) {
  if (error instanceof OperationalError || isLockError(error))
    return { ok: false as const, error: error.message }
  console.error('[OPS1] operational_action_failed')
  return {
    ok: false as const,
    error: 'No se ha podido guardar. Recarga para comprobar el estado y vuelve a intentarlo.',
  }
}
function invalidateDelivery(id: string) {
  for (const path of [
    '/entregas',
    `/entregas/${id}`,
    '/calendario',
    '/vehiculos',
    '/compradores',
    '/comprar',
    '/comprar/vehiculos',
    '/dashboard',
    '/postventa',
  ])
    revalidatePath(path)
  for (const path of ['/compradores/[id]', '/vendedores/[id]', '/comprar/[id]'])
    revalidatePath(path, 'page')
}
export async function searchOperationalTargets(raw: unknown) {
  await requireRole(['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS'])
  const parsed = operationalSearchSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Búsqueda inválida.' }
  const { type, query, page } = parsed.data
  try {
    const paging = { take: 21, skip: page * 20 }
    const plate = query.replace(/[^a-zA-Z0-9]/g, '')
    const items =
      type === 'vehicle'
        ? (
            await db.vehicle.findMany({
              ...paging,
              where: query
                ? {
                    OR: [
                      { plate: { contains: query, mode: 'insensitive' } },
                      ...(plate
                        ? [{ plate: { contains: plate, mode: 'insensitive' as const } }]
                        : []),
                      { brand: { contains: query, mode: 'insensitive' } },
                      { model: { contains: query, mode: 'insensitive' } },
                    ],
                  }
                : {},
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              select: { id: true, brand: true, model: true, plate: true },
            })
          ).map((v) => ({
            id: v.id,
            label: `${v.plate ?? 'Sin matrícula'} · ${[v.brand, v.model].filter(Boolean).join(' ') || 'Vehículo sin identificar'}`,
          }))
        : type === 'buyerLead'
          ? (
              await db.buyerLead.findMany({
                ...paging,
                where: query ? { name: { contains: query, mode: 'insensitive' } } : {},
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                select: { id: true, name: true },
              })
            ).map((v) => ({ id: v.id, label: `${v.name ?? 'Sin nombre'} · ${v.id.slice(-6)}` }))
          : (
              await db.sellerLead.findMany({
                ...paging,
                where: query ? { name: { contains: query, mode: 'insensitive' } } : {},
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                select: { id: true, name: true },
              })
            ).map((v) => ({ id: v.id, label: `${v.name ?? 'Sin nombre'} · ${v.id.slice(-6)}` }))
    return { ok: true as const, items: items.slice(0, 20), hasMore: items.length > 20 }
  } catch {
    return { ok: false as const, error: 'No se pudo cargar la búsqueda. Vuelve a intentarlo.' }
  }
}
export async function createManualDelivery(raw: unknown) {
  const actor = await requireRole(OPERATIONAL_DELIVERY_ROLES)
  if (operationalWritesPaused()) return { ok: false as const, error: OPS1_PAUSED_MESSAGE }
  const parsed = manualDeliverySchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false as const,
      error: manualDeliveryValidationMessage(parsed.error),
    }
  const input = parsed.data
  try {
    const vehicle = await db.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: { sellerLeadId: true },
    })
    if (!vehicle) return { ok: false as const, error: 'Vehículo no encontrado.' }
    const roots = buildDeliveryCreationRoots({
      vehicleId: input.vehicleId,
      sellerLeadId: vehicle.sellerLeadId,
      buyerLeadId: input.recipient.type === 'buyerLead' ? input.recipient.id : null,
      recipientSellerLeadId: input.recipient.type === 'sellerLead' ? input.recipient.id : null,
    })
    const result = await withLockedRoots(roots, (tx) =>
      createOperationalDeliveryTx(tx, input, actor.id, vehicle.sellerLeadId)
    )
    invalidateDelivery(result.id)
    return { ok: true as const, id: result.id }
  } catch (error) {
    try {
      const identity = creationIdentity(actor.id, input)
      const previous = await db.delivery.findUnique({
        where: { creationKey: identity.key },
        select: { id: true, creationFingerprint: true },
      })
      if (previous)
        return previous.creationFingerprint === identity.fingerprint
          ? { ok: true as const, id: previous.id }
          : {
              ok: false as const,
              error: 'Esta solicitud ya se usó con otros datos. Inicia una nueva entrega.',
            }
    } catch {
      /* Estado incierto: no inventar éxito ni iniciar otra operación. */
    }
    return safeFailure(error)
  }
}
const transitionSchema = z.object({
  id: z.string().min(1).max(100),
  target: z.enum(['EN_CURSO', 'COMPLETADA', 'CANCELADA']),
  reason: z.string().trim().max(500).optional(),
})
export async function changeManualDelivery(raw: unknown) {
  const actor = await requireRole(OPERATIONAL_DELIVERY_ROLES)
  if (operationalWritesPaused()) return { ok: false as const, error: OPS1_PAUSED_MESSAGE }
  const parsed = transitionSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Datos de entrega inválidos.' }
  try {
    const p = await db.delivery.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        vehicleId: true,
        buyerLeadId: true,
        recipientSellerLeadId: true,
        vehicle: { select: { sellerLeadId: true } },
      },
    })
    if (!p) return { ok: false as const, error: 'Entrega no encontrada.' }
    await withLockedRoots(
      buildDeliveryCreationRoots({ ...p, sellerLeadId: p.vehicle.sellerLeadId }),
      (tx) =>
        changeOperationalDeliveryTx(
          tx,
          { ...p, sellerLeadId: p.vehicle.sellerLeadId },
          actor.id,
          parsed.data.target,
          new Date(),
          parsed.data.reason
        )
    )
    invalidateDelivery(p.id)
    return { ok: true as const }
  } catch (error) {
    return safeFailure(error)
  }
}
export async function updateOperationalChecklist(itemId: string, raw: unknown) {
  await requireRole(OPERATIONAL_DELIVERY_ROLES)
  if (operationalWritesPaused()) return { ok: false as const, error: OPS1_PAUSED_MESSAGE }
  const parsed = z
    .object({
      result: z.enum(['PENDIENTE', 'OK', 'INCIDENCIA', 'NO_APLICA']),
      notes: z.string().max(2000).nullable().optional(),
    })
    .safeParse(raw)
  if (!parsed.success || !itemId || itemId.length > 100)
    return { ok: false as const, error: 'Datos inválidos.' }
  try {
    const item = await db.deliveryChecklistItem.findUnique({
      where: { id: itemId },
      select: { deliveryId: true, delivery: { select: { vehicleId: true } } },
    })
    if (!item) return { ok: false as const, error: 'Ítem no encontrado.' }
    await withLockedRoots([{ type: 'vehicle', id: item.delivery.vehicleId }], async (tx) => {
      const current = await tx.delivery.findUnique({
        where: { id: item.deliveryId },
        select: { status: true, vehicleId: true },
      })
      if (
        !current ||
        current.vehicleId !== item.delivery.vehicleId ||
        !['PROGRAMADA', 'EN_CURSO'].includes(current.status)
      )
        throw new OperationalError('La entrega ya está cerrada o ha cambiado.')
      const changed = await tx.deliveryChecklistItem.updateMany({
        where: { id: itemId, deliveryId: item.deliveryId },
        data: parsed.data,
      })
      if (changed.count !== 1) throw new OperationalError('El ítem ha cambiado.')
    })
    revalidatePath(`/entregas/${item.deliveryId}`)
    return { ok: true as const }
  } catch (error) {
    return safeFailure(error)
  }
}
