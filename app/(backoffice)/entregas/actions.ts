'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { createWarrantyForDelivery } from '@/lib/postventa'
import { sendDeliveryConfirmation } from '@/lib/email/send'
import type { DeliveryStatus } from '@prisma/client'

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const VALID_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  PROGRAMADA: ['EN_CURSO', 'CANCELADA'],
  EN_CURSO: ['COMPLETADA', 'CANCELADA'],
}

function isValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// 14-item checklist created with every delivery
const INITIAL_CHECKLIST = [
  { category: 'PRE_ENTREGA' as const, item: 'Limpieza final OK' },
  { category: 'PRE_ENTREGA' as const, item: 'Niveles revisados' },
  { category: 'PRE_ENTREGA' as const, item: 'Documentación preparada' },
  { category: 'PRE_ENTREGA' as const, item: 'Garantía preparada' },
  { category: 'PRE_ENTREGA' as const, item: 'Cita confirmada' },
  { category: 'EXPLICACION' as const, item: 'Explicar agua, gas y luz' },
  { category: 'EXPLICACION' as const, item: 'Explicar boiler/calefacción' },
  { category: 'EXPLICACION' as const, item: 'Explicar placas/baterías' },
  { category: 'EXPLICACION' as const, item: 'Prueba cierres y accesorios' },
  { category: 'EXPLICACION' as const, item: 'Resolver dudas cliente' },
  { category: 'FIRMA_SALIDA' as const, item: 'Contrato final' },
  { category: 'FIRMA_SALIDA' as const, item: 'Factura' },
  { category: 'FIRMA_SALIDA' as const, item: 'Documento entrega' },
  { category: 'FIRMA_SALIDA' as const, item: 'Fotos entrega' },
]

const createDeliverySchema = z.object({
  vehicleId: z.string().min(1),
  buyerLeadId: z.string().min(1),
  scheduledAt: z.string().min(1),
  responsableId: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

const signDeliverySchema = z.object({
  signedByName: z.string().min(1, 'Nombre requerido').trim(),
  signedByDni: z.string().min(1, 'DNI requerido').trim(),
  signatureUrl: z.string().min(1, 'Firma requerida'),
})

export async function createDelivery(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requireAuth()

  const parsed = createDeliverySchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const { vehicleId, buyerLeadId, scheduledAt, responsableId, notes } = parsed.data

  const delivery = await db.delivery.create({
    data: {
      vehicleId,
      buyerLeadId,
      responsableId: responsableId ?? null,
      scheduledAt: new Date(scheduledAt),
      notes: notes ?? null,
      checklist: {
        create: INITIAL_CHECKLIST.map((c) => ({ ...c, result: 'PENDIENTE' as const })),
      },
    },
    include: {
      buyerLead: { select: { name: true, email: true } },
      vehicle: { select: { brand: true, model: true } },
    },
  })

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })

  await db.activity.create({
    data: {
      type: 'ENTREGA_PROGRAMADA',
      content: `Entrega programada para el ${new Date(scheduledAt).toLocaleDateString('es-ES')}`,
      agentId: actor.id,
      sellerLeadId: vehicle?.sellerLeadId ?? null,
      buyerLeadId,
    },
  })

  // Non-blocking confirmation email to buyer
  sendDeliveryConfirmation({
    buyerName: delivery.buyerLead.name,
    buyerEmail: delivery.buyerLead.email,
    vehicleLabel: `${delivery.vehicle.brand} ${delivery.vehicle.model}`,
    scheduledAt: new Date(scheduledAt),
    deliveryId: delivery.id,
  }).catch(console.error)

  revalidatePath('/entregas')
  return { ok: true, data: { id: delivery.id } }
}

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: DeliveryStatus
): Promise<ActionResult> {
  const actor = await requireAuth()

  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      status: true,
      vehicleId: true,
      buyerLeadId: true,
      signedByName: true,
      signedByDni: true,
      signatureUrl: true,
      vehicle: { select: { sellerLeadId: true } },
      checklist: { select: { result: true } },
    },
  })
  if (!delivery) return { ok: false, error: 'Entrega no encontrada' }

  if (!isValidDeliveryTransition(delivery.status, newStatus)) {
    return { ok: false, error: `Transición ${delivery.status} → ${newStatus} no permitida.` }
  }

  if (newStatus === 'COMPLETADA') {
    const pending = delivery.checklist.filter((c) => c.result === 'PENDIENTE')
    if (pending.length > 0) {
      return { ok: false, error: `Hay ${pending.length} ítems pendientes en el checklist.` }
    }
    if (!delivery.signedByName || !delivery.signedByDni || !delivery.signatureUrl) {
      return { ok: false, error: 'La entrega requiere firma antes de completarse.' }
    }
  }

  const now = new Date()

  await db.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: deliveryId },
      data: {
        status: newStatus,
        ...(newStatus === 'EN_CURSO' && { startedAt: now }),
        ...(newStatus === 'COMPLETADA' && { completedAt: now }),
      },
    })

    if (newStatus === 'COMPLETADA') {
      // Vehicle → VENDIDO
      await tx.vehicle.update({
        where: { id: delivery.vehicleId },
        data: { status: 'VENDIDO', soldAt: now },
      })
      // Matching match → CERRADO (the one in OFERTA state for this vehicle/buyer pair)
      await tx.match.updateMany({
        where: {
          vehicleId: delivery.vehicleId,
          buyerLeadId: delivery.buyerLeadId,
          status: 'OFERTA',
        },
        data: { status: 'CERRADO' },
      })
      // BuyerLead → CERRADO
      await tx.buyerLead.update({
        where: { id: delivery.buyerLeadId },
        data: { status: 'CERRADO' },
      })

      await tx.activity.create({
        data: {
          type: 'CAMBIO_ESTADO',
          content: 'Vehículo marcado como VENDIDO automáticamente al completar la entrega.',
          agentId: actor.id,
          sellerLeadId: delivery.vehicle.sellerLeadId,
        },
      })
      await tx.activity.create({
        data: {
          type: 'ENTREGA_COMPLETADA',
          content: 'Entrega completada y firmada.',
          agentId: actor.id,
          sellerLeadId: delivery.vehicle.sellerLeadId,
          buyerLeadId: delivery.buyerLeadId,
        },
      })
    }

    if (newStatus === 'CANCELADA') {
      await tx.activity.create({
        data: {
          type: 'ENTREGA_CANCELADA',
          content: 'Entrega cancelada.',
          agentId: actor.id,
          sellerLeadId: delivery.vehicle.sellerLeadId,
          buyerLeadId: delivery.buyerLeadId,
        },
      })
    }
  })

  // Create warranty + followups outside the transaction (uses deliveryId, not inside tx)
  if (newStatus === 'COMPLETADA') {
    await createWarrantyForDelivery(deliveryId, db)

    const warranty = await db.warranty.findUnique({
      where: { deliveryId },
      select: { id: true },
    })
    if (warranty) {
      await db.activity.create({
        data: {
          type: 'GARANTIA_ACTIVADA',
          content: 'Garantía de 12 meses activada automáticamente.',
          agentId: actor.id,
          sellerLeadId: delivery.vehicle.sellerLeadId,
          buyerLeadId: delivery.buyerLeadId,
        },
      })
    }
  }

  revalidatePath('/entregas')
  revalidatePath(`/entregas/${deliveryId}`)
  revalidatePath(`/vendedores/${delivery.vehicle.sellerLeadId}`)
  revalidatePath(`/compradores/${delivery.buyerLeadId}`)
  return { ok: true }
}

export async function updateDeliveryChecklistItem(
  itemId: string,
  data: { result: string; notes?: string | null }
): Promise<ActionResult> {
  await requireAuth()

  await db.deliveryChecklistItem.update({
    where: { id: itemId },
    data: {
      result: data.result as 'PENDIENTE' | 'OK' | 'INCIDENCIA' | 'NO_APLICA',
      notes: data.notes ?? null,
    },
  })

  const item = await db.deliveryChecklistItem.findUnique({
    where: { id: itemId },
    select: { deliveryId: true },
  })
  if (item) revalidatePath(`/entregas/${item.deliveryId}`)
  return { ok: true }
}

export async function signDelivery(deliveryId: string, formData: unknown): Promise<ActionResult> {
  const actor = await requireAuth()

  const parsed = signDeliverySchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos de firma inválidos' }

  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: { status: true, responsableId: true },
  })
  if (!delivery) return { ok: false, error: 'Entrega no encontrada' }
  if (delivery.status === 'COMPLETADA' || delivery.status === 'CANCELADA') {
    return { ok: false, error: 'La entrega ya está cerrada.' }
  }
  if (actor.role !== 'ADMIN' && delivery.responsableId !== actor.id) {
    return { ok: false, error: 'Solo el responsable de la entrega o un admin puede firmar.' }
  }

  const { signedByName, signedByDni, signatureUrl } = parsed.data

  await db.delivery.update({
    where: { id: deliveryId },
    data: { signedByName, signedByDni, signatureUrl },
  })

  revalidatePath(`/entregas/${deliveryId}`)
  return { ok: true }
}

export async function cancelDelivery(deliveryId: string, reason?: string): Promise<ActionResult> {
  return updateDeliveryStatus(deliveryId, 'CANCELADA').then((res) => {
    if (res.ok && reason) {
      db.delivery
        .update({ where: { id: deliveryId }, data: { cancellationReason: reason } })
        .catch(console.error)
    }
    return res
  })
}

export async function uploadDeliveryDocument(
  deliveryId: string,
  data: { category: string; name: string; url: string }
): Promise<ActionResult> {
  const actor = await requireAuth()

  await db.deliveryDocument.create({
    data: {
      deliveryId,
      category: data.category as import('@prisma/client').DeliveryDocumentCategory,
      name: data.name,
      url: data.url,
      uploadedById: actor.id,
    },
  })

  revalidatePath(`/entregas/${deliveryId}`)
  return { ok: true }
}

export async function deleteDeliveryDocument(docId: string): Promise<ActionResult> {
  await requireAdmin()
  await db.deliveryDocument.delete({ where: { id: docId } })
  return { ok: true }
}
