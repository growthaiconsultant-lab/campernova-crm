'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { phonesMatch } from '@/lib/phone'
import { findDuplicateCaptureByPhone, isValidCaptureStatus, isValidPortal } from '@/lib/captacion'
import { isValidLostReason } from '@/lib/lost-reason'
import type { CaptureStatus, LostReason } from '@prisma/client'

type Duplicate = { kind: 'capture'; id: string } | { kind: 'seller'; id: string; name: string }

type CreateInput = {
  listingUrl: string
  phone: string
  portal: string
  title?: string | null
  askingPrice?: number | null
  assignedToId?: string | null
}

/** F1: crea una captación de portal. Avisa de duplicados por teléfono. */
export async function createCapture(
  data: CreateInput,
  allowDuplicate = false
): Promise<{ error?: string; id?: string; duplicate?: Duplicate }> {
  const actor = await requireAgente()

  const listingUrl = data.listingUrl?.trim()
  const phone = data.phone?.trim()
  if (!listingUrl) return { error: 'Pega el link del anuncio' }
  if (!phone) return { error: 'Falta el teléfono' }
  if (!isValidPortal(data.portal)) return { error: 'Portal no válido' }

  if (!allowDuplicate) {
    const [captures, sellers] = await Promise.all([
      db.vehicleCapture.findMany({ select: { id: true, phone: true, status: true } }),
      db.sellerLead.findMany({ select: { id: true, name: true, phone: true } }),
    ])
    const dupCap = findDuplicateCaptureByPhone(phone, captures)
    if (dupCap) return { duplicate: { kind: 'capture', id: dupCap.id } }
    const dupSeller = sellers.find((s) => phonesMatch(s.phone, phone))
    if (dupSeller) return { duplicate: { kind: 'seller', id: dupSeller.id, name: dupSeller.name } }
  }

  const capture = await db.vehicleCapture.create({
    data: {
      listingUrl,
      phone,
      portal: data.portal,
      title: data.title?.trim() || null,
      askingPrice: data.askingPrice ?? null,
      assignedToId: data.assignedToId || actor.id,
      createdById: actor.id,
    },
  })

  revalidatePath('/captaciones')
  return { id: capture.id }
}

/**
 * F1: cambia el estado de una captación. RECHAZADO admite motivo.
 * (ENTRADA_AGENDADA con fecha se maneja en F2.)
 */
export async function updateCaptureStatus(
  id: string,
  status: string,
  rejectionReason?: string
): Promise<{ error?: string }> {
  await requireAgente()
  if (!isValidCaptureStatus(status)) return { error: 'Estado no válido' }

  const capture = await db.vehicleCapture.findUnique({ where: { id }, select: { id: true } })
  if (!capture) return { error: 'Captación no encontrada' }

  let reason: LostReason | null = null
  if (status === 'RECHAZADO' && rejectionReason) {
    if (!isValidLostReason(rejectionReason)) return { error: 'Motivo no válido' }
    reason = rejectionReason
  }

  await db.vehicleCapture.update({
    where: { id },
    data: {
      status: status as CaptureStatus,
      ...(status === 'RECHAZADO' ? { rejectionReason: reason } : {}),
    },
  })

  revalidatePath('/captaciones')
  return {}
}

/**
 * F2: agenda la Entrada (recepción del vehículo en la nave) con fecha/hora.
 * Pone el estado en ENTRADA_AGENDADA. La entrada aparece en el calendario.
 */
export async function scheduleEntrada(
  id: string,
  dateTimeIso: string
): Promise<{ error?: string }> {
  await requireAgente()
  const date = new Date(dateTimeIso)
  if (isNaN(date.getTime())) return { error: 'Fecha no válida' }

  const capture = await db.vehicleCapture.findUnique({ where: { id }, select: { id: true } })
  if (!capture) return { error: 'Captación no encontrada' }

  await db.vehicleCapture.update({
    where: { id },
    data: { status: 'ENTRADA_AGENDADA', entradaScheduledAt: date },
  })

  revalidatePath('/captaciones')
  revalidatePath('/calendario')
  return {}
}

type EditInput = {
  notes?: string | null
  assignedToId?: string | null
  askingPrice?: number | null
  title?: string | null
  portal?: string | null
}

/** F1: edita campos de una captación (notas, responsable, precio, título, portal). */
export async function updateCapture(id: string, data: EditInput): Promise<{ error?: string }> {
  await requireAgente()

  if (data.portal != null && !isValidPortal(data.portal)) return { error: 'Portal no válido' }

  const capture = await db.vehicleCapture.findUnique({ where: { id }, select: { id: true } })
  if (!capture) return { error: 'Captación no encontrada' }

  await db.vehicleCapture.update({
    where: { id },
    data: {
      ...(data.notes !== undefined ? { notes: data.notes?.trim().slice(0, 1000) || null } : {}),
      ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId || null } : {}),
      ...(data.askingPrice !== undefined ? { askingPrice: data.askingPrice } : {}),
      ...(data.title !== undefined ? { title: data.title?.trim() || null } : {}),
      ...(data.portal != null ? { portal: data.portal as never } : {}),
    },
  })

  revalidatePath('/captaciones')
  return {}
}
