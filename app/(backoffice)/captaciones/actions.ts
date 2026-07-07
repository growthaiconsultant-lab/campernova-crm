'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { phonesMatch } from '@/lib/phone'
import {
  findDuplicateCaptureByPhone,
  isValidCaptureStatus,
  isValidPortal,
  splitCaptureTitle,
  PORTAL_LABELS,
} from '@/lib/captacion'
import { isValidLostReason } from '@/lib/lost-reason'
import { defaultNextActionData } from '@/lib/next-action'
import { runAndSaveAutoValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'
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

/**
 * F3: convierte una captación en un lead de vendedor (canal CN) + Vehicle
 * prellenado. Marca la captación CONVERTIDO y la vincula. Idempotente: si ya
 * está convertida, devuelve el lead existente. El comercial completa la ficha.
 */
export async function convertCaptureToSellerLead(
  id: string
): Promise<{ error?: string; sellerLeadId?: string }> {
  const actor = await requireAgente()

  const capture = await db.vehicleCapture.findUnique({
    where: { id },
    select: {
      id: true,
      listingUrl: true,
      phone: true,
      title: true,
      portal: true,
      askingPrice: true,
      notes: true,
      status: true,
      assignedToId: true,
      sellerLeadId: true,
    },
  })
  if (!capture) return { error: 'Captación no encontrada' }
  if (capture.sellerLeadId) {
    // Ya convertida → idempotente, devuelve el lead existente
    return { sellerLeadId: capture.sellerLeadId }
  }

  const { brand, model } = splitCaptureTitle(capture.title)
  const originParts = [
    `Origen: captación de ${PORTAL_LABELS[capture.portal]} (${capture.listingUrl ?? ''}).`.trim(),
    capture.askingPrice ? `Pide ${Number(capture.askingPrice).toLocaleString('es-ES')} €.` : '',
    capture.notes ? `Observaciones: ${capture.notes}` : '',
  ].filter(Boolean)
  const originNote = originParts.join(' ')

  const seller = await db.sellerLead.create({
    data: {
      name: capture.title?.trim() || `Vendedor ${PORTAL_LABELS[capture.portal]}`,
      email: '', // la captación no trae email; el comercial lo completa
      phone: capture.phone,
      canal: 'CN',
      status: 'NUEVO',
      agentId: capture.assignedToId ?? actor.id,
      ...defaultNextActionData(),
      vehicle: {
        create: {
          type: 'AUTOCARAVANA', // el comercial ajusta tipo/año/km/plazas en la ficha
          brand,
          model,
          year: new Date().getFullYear(),
          km: 0,
          seats: 4,
          conservationState: 'NORMAL',
          equipment: {},
          desiredPrice: capture.askingPrice ?? null,
          status: 'NUEVO',
        },
      },
      activities: {
        create: { type: 'NOTA', content: originNote },
      },
    },
    include: { vehicle: true },
  })

  await db.$transaction([
    db.vehicleCapture.update({
      where: { id },
      data: { status: 'CONVERTIDO', sellerLeadId: seller.id },
    }),
    db.activity.create({
      data: {
        type: 'NOTA',
        content: `Convertida a lead de vendedor desde captación (${PORTAL_LABELS[capture.portal]}). Ficha: /vendedores/${seller.id}`,
        sellerLeadId: seller.id,
      },
    }),
  ])

  // Tasación + matching del nuevo vehículo (no bloqueantes)
  const vehicleId = seller.vehicle!.id
  await runAndSaveAutoValuation(vehicleId, {
    brand,
    model,
    type: 'AUTOCARAVANA',
    year: new Date().getFullYear(),
    km: 0,
    conservationState: 'NORMAL',
    equipment: {},
  })
  await recalculateMatchesForVehicle(vehicleId, db)

  revalidatePath('/captaciones')
  revalidatePath('/vendedores')
  return { sellerLeadId: seller.id }
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
