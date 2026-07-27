'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { updateSellerLeadSchema, updateVehicleSchema } from '@/lib/validators/seller-lead'
import { runAndSavePreliminaryValuation } from '@/lib/valuation/save'
import { officialValuationTx, buildOfficialValuationRoots, isValuationError } from '@/lib/valuation'
import type { EquipmentFlags } from '@/lib/valuation'
import { recalculateMatchesForVehicle } from '@/lib/matching'
import {
  SELLER_LEAD_TRANSITIONS,
  SELLER_LEAD_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
  isValidTransition,
} from '@/lib/state-machine'
import type { SellerLeadStatus } from '@prisma/client'
import { isValidLostReason, LOST_REASON_LABELS } from '@/lib/lost-reason'
import {
  applyManualVehicleUpdateTx,
  buildVehicleUpdateRoots,
  isVehicleStatusConflict,
  isVehicleUpdateError,
  VEHICLE_STATUS_CONFLICT_MESSAGE,
} from '@/lib/vehicle-status'
import { withLockedRoots, isLockError } from '@/lib/locking'
import type { VehicleStatus } from '@prisma/client'

/**
 * El expediente legal no permite pasar a `TASADO`/`PUBLICADO`. Se lanza dentro de la transacción
 * (bajo el lock) para abortarla; el registro de auditoría `PUBLICACION_BLOQUEADA` se escribe fuera.
 */
class VehiclePublicationBlockedError extends Error {
  constructor(
    readonly targetStatus: VehicleStatus,
    readonly lines: string[]
  ) {
    super('VEHICLE_PUBLICATION_BLOCKED')
    this.name = 'VehiclePublicationBlockedError'
  }
}
import {
  getVehicleLegalInput,
  getVehicleDocumentSummary,
  listMissingRequirements,
  isReadyForStatus,
} from '@/lib/vehicle-legal'

export async function updateSellerLead(leadId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = updateSellerLeadSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const { name, email, phone, status, agentId, minPrice, dealType, urgency, riskLevel, riskNotes } =
    parsed.data

  const currentLead = await db.sellerLead.findUnique({
    where: { id: leadId },
    select: { status: true, agentId: true, agent: { select: { name: true } } },
  })
  if (!currentLead) return { error: { formErrors: ['Lead no encontrado'], fieldErrors: {} } }

  if (!isValidTransition(SELLER_LEAD_TRANSITIONS, currentLead.status, status)) {
    return {
      error: {
        formErrors: [
          `Transición no permitida: ${SELLER_LEAD_STATUS_LABELS[currentLead.status]} → ${SELLER_LEAD_STATUS_LABELS[status]}`,
        ],
        fieldErrors: {},
      },
    }
  }

  const agentChanging = agentId !== currentLead.agentId
  const statusChanging = status !== currentLead.status

  if (agentChanging && actor.role !== 'ADMIN') {
    return { error: { formErrors: ['Solo el admin puede reasignar el agente'], fieldErrors: {} } }
  }

  let agentActivityContent: string | null = null
  if (agentChanging) {
    const newAgentName = agentId
      ? ((await db.user.findUnique({ where: { id: agentId }, select: { name: true } }))?.name ??
        agentId)
      : null
    const oldAgentName = currentLead.agent?.name ?? null

    if (!oldAgentName && newAgentName) {
      agentActivityContent = `Asignado a ${newAgentName}`
    } else if (oldAgentName && !newAgentName) {
      agentActivityContent = `Desasignado (antes: ${oldAgentName})`
    } else {
      agentActivityContent = `Reasignado de ${oldAgentName} a ${newAgentName}`
    }
  }

  await db.$transaction(async (tx) => {
    await tx.sellerLead.update({
      where: { id: leadId },
      data: {
        name,
        email,
        phone,
        status,
        agentId: agentId ?? null,
        minPrice: minPrice ?? null,
        dealType: dealType ?? null,
        urgency: urgency ?? null,
        riskLevel: riskLevel ?? null,
        riskNotes: riskNotes?.trim() || null,
      },
    })
    if (agentChanging && agentActivityContent) {
      await tx.activity.create({
        data: {
          type: 'LEAD_ASIGNADO',
          content: agentActivityContent,
          agentId: actor.id,
          sellerLeadId: leadId,
        },
      })
    }
    if (statusChanging) {
      await tx.activity.create({
        data: {
          type: 'CAMBIO_ESTADO',
          content: `Estado cambiado: ${SELLER_LEAD_STATUS_LABELS[currentLead.status]} → ${SELLER_LEAD_STATUS_LABELS[status]}`,
          agentId: actor.id,
          sellerLeadId: leadId,
        },
      })
    }
  })

  revalidatePath(`/vendedores/${leadId}`)
  revalidatePath('/vendedores')
  return { ok: true }
}

export async function updateVehicle(vehicleId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = updateVehicleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const {
    type,
    brand,
    model,
    year,
    km,
    seats,
    length,
    conservationState,
    location,
    desiredPrice,
    equipment,
    status,
    category,
    bedLayout,
    sleepingPlaces,
    bathroomType,
    heatingType,
    winterized,
    hasGarage,
    maxMassKg,
    heightM,
    offGrid,
  } = parsed.data

  // Baño = fuente única (bathroomType): derivamos el flag de equipo para coherencia.
  const equipmentResolved = {
    ...equipment,
    bathroom: bathroomType != null ? bathroomType !== 'NINGUNO' : equipment.bathroom,
  }

  // Lectura preliminar: solo resuelve identidades para las raíces del lock. Ninguna decisión de
  // negocio se toma sobre estos datos; todo se relee dentro de la transacción.
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { error: { formErrors: ['Vehículo no encontrado'], fieldErrors: {} } }

  const roots = buildVehicleUpdateRoots({ vehicleId, sellerLeadId: vehicle.sellerLeadId })

  // La venta y la reserva ya no son alcanzables desde aquí (I3A): `VEHICLE_TRANSITIONS` solo ofrece
  // `NUEVO → TASADO` y `TASADO → PUBLICADO`. `soldAt` lo fija el propietario de la venta,
  // `completeDeliveryTx`. I3B mete la edición manual bajo `withLockedRoots`.
  try {
    await withLockedRoots(roots, (tx) =>
      applyManualVehicleUpdateTx(
        tx,
        {
          vehicleId,
          resolvedSellerLeadId: vehicle.sellerLeadId,
          nextStatus: status,
          actorId: actor.id,
          activityContent: (from) =>
            `Vehículo: ${VEHICLE_STATUS_LABELS[from]} → ${VEHICLE_STATUS_LABELS[status]}`,
          data: {
            type,
            brand,
            model,
            year,
            km,
            seats,
            length: length ?? null,
            conservationState,
            location: location ?? null,
            desiredPrice: desiredPrice ?? null,
            equipment: equipmentResolved,
            status,
            category: category ?? null,
            bedLayout: bedLayout ?? null,
            sleepingPlaces: sleepingPlaces ?? null,
            bathroomType: bathroomType ?? null,
            heatingType: heatingType ?? null,
            winterized: winterized ?? null,
            hasGarage: hasGarage ?? null,
            maxMassKg: maxMassKg ?? null,
            heightM: heightM ?? null,
            offGrid: offGrid ?? null,
          },
        },
        {
          // Guard legal para TASADO/PUBLICADO, releído con `tx` bajo el lock del vehículo. Las
          // columnas del vehículo son estables (lock); los documentos son tabla aparte (límite
          // documentado, DELIVERY/expediente se cierran fuera de I3B).
          beforeWrite: async ({ fromStatus, tx }) => {
            const isTransitioningTo = (s: string) => status === s && fromStatus !== s
            if (!isTransitioningTo('TASADO') && !isTransitioningTo('PUBLICADO')) return
            const targetStatus = status as 'TASADO' | 'PUBLICADO'
            const txDb = tx as unknown as typeof db
            const [legalInput, docs] = await Promise.all([
              getVehicleLegalInput(txDb, vehicleId),
              getVehicleDocumentSummary(txDb, vehicleId),
            ])
            const merged = legalInput
              ? { ...legalInput, desiredPrice: desiredPrice ?? legalInput.desiredPrice }
              : null
            if (!merged || !isReadyForStatus(merged, targetStatus, docs)) {
              const missing = merged ? listMissingRequirements(merged, targetStatus, docs) : []
              const lines = missing
                .filter((r) => r.severity === 'error')
                .map((r) => `- ${r.message}`)
              throw new VehiclePublicationBlockedError(targetStatus, lines)
            }
          },
        }
      )
    )
  } catch (err) {
    // Publicación bloqueada por el expediente legal: se registra la auditoría FUERA de la
    // transacción (ya revertida) y se devuelve el detalle, como antes.
    if (err instanceof VehiclePublicationBlockedError) {
      await db.activity.create({
        data: {
          type: 'PUBLICACION_BLOQUEADA',
          content: `Intento de pasar a ${VEHICLE_STATUS_LABELS[err.targetStatus]} bloqueado.\n${err.lines.join('\n')}`,
          agentId: actor.id,
          sellerLeadId: vehicle.sellerLeadId,
        },
      })
      return {
        error: {
          formErrors: [
            `El vehículo no puede pasar a ${VEHICLE_STATUS_LABELS[err.targetStatus]}. Faltan:\n${err.lines.join('\n')}\n\nCompleta el expediente legal en la sección 'Expediente' de la ficha del vehículo antes de reintentar.`,
          ],
          fieldErrors: {},
        },
      }
    }
    if (isVehicleStatusConflict(err)) {
      return { error: { formErrors: [VEHICLE_STATUS_CONFLICT_MESSAGE], fieldErrors: {} } }
    }
    if (isVehicleUpdateError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    if (isLockError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    // Error técnico inesperado → propágalo; no se disfraza de conflicto de negocio.
    throw err
  }

  // A3: re-valoración PRELIMINAR tras cambios de datos del vehículo. No cambia estado ni escribe
  // los denormalizados oficiales; la tasación oficial (gated) es la única que lo hace.
  await runAndSavePreliminaryValuation(
    vehicleId,
    { brand, model, type, year, km, conservationState, equipment: equipmentResolved },
    actor.id
  )
  await recalculateMatchesForVehicle(vehicleId, db)

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true }
}

/**
 * Descarta un vendedor: decisión COMERCIAL que lleva el lead al estado terminal `DESCARTADO`
 * con un motivo estructurado. NO archiva, NO oculta el registro de las bandejas y NO elimina
 * datos. El nombre `archive*` queda reservado para el archivado real (aún no implementado).
 */
export async function discardSellerLead(
  leadId: string,
  lostReason?: string,
  lostReasonNotes?: string
) {
  const actor = await requireAgente()

  // CAM-61: motivo estructurado obligatorio al descartar
  if (!lostReason || !isValidLostReason(lostReason)) {
    return { error: 'Selecciona el motivo del descarte' }
  }
  const notes = lostReasonNotes?.trim().slice(0, 500) || null

  const lead = await db.sellerLead.findUnique({
    where: { id: leadId },
    select: { status: true },
  })
  if (!lead) return { error: 'Lead no encontrado' }

  if (!isValidTransition(SELLER_LEAD_TRANSITIONS, lead.status, 'DESCARTADO')) {
    return { error: 'Este lead ya está en estado final' }
  }

  await db.$transaction(async (tx) => {
    await tx.sellerLead.update({
      where: { id: leadId },
      data: { status: 'DESCARTADO', lostReason, lostReasonNotes: notes },
    })
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: `Estado cambiado: ${SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus]} → ${SELLER_LEAD_STATUS_LABELS['DESCARTADO']} · Motivo: ${LOST_REASON_LABELS[lostReason]}${notes ? ` — ${notes}` : ''}`,
        agentId: actor.id,
        sellerLeadId: leadId,
      },
    })
  })

  revalidatePath(`/vendedores/${leadId}`)
  revalidatePath('/vendedores')
  return { error: null }
}

export async function addSellerLeadNote(leadId: string, content: string) {
  const actor = await requireAgente()

  const trimmed = content.trim()
  if (!trimmed) return { error: 'El contenido no puede estar vacío' }
  if (trimmed.length > 2000) return { error: 'Máximo 2000 caracteres' }

  await db.activity.create({
    data: {
      type: 'NOTA',
      content: trimmed,
      agentId: actor.id,
      sellerLeadId: leadId,
    },
  })

  revalidatePath(`/vendedores/${leadId}`)
  return { ok: true }
}

// ─── Tasación oficial (A3) ──────────────────────────────────────────────────
// La tasación oficial exige ENTRADA OFICIAL ACTIVA + INSPECCIÓN DE ENTRADA COMPLETADA (gate estricto,
// sin bypass manual en v1). Es la ÚNICA vía que escribe los denormalizados oficiales y transiciona
// `NUEVO → TASADO`. El núcleo transaccional (locks + CAS) vive en `officialValuationTx`.

const officialManualSchema = z
  .object({
    min: z.number().nonnegative('No puede ser negativo'),
    recommended: z.number().nonnegative('No puede ser negativo'),
    max: z.number().nonnegative('No puede ser negativo'),
    confidence: z.enum(['ALTA', 'MEDIA', 'BAJA']),
    reason: z.string().trim().min(1, 'Indica el motivo de la tasación'),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => d.recommended >= d.min, {
    message: 'El precio recomendado debe ser ≥ mínimo',
    path: ['recommended'],
  })
  .refine((d) => d.max >= d.recommended, {
    message: 'El máximo debe ser ≥ recomendado',
    path: ['max'],
  })

/**
 * Registra una tasación OFICIAL MANUAL (guard: Comercial/ADMIN via `requireAgente`). Confianza
 * DECLARADA explícitamente (fin del hardcode `ALTA`), motivo obligatorio, rango válido. Gated bajo
 * el lock por entrada activa + inspección completada.
 */
export async function officialManualValuation(vehicleId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = officialManualSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  const { min, recommended, max, confidence, reason, notes } = parsed.data

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { error: { formErrors: ['Vehículo no encontrado'], fieldErrors: {} } }

  const roots = buildOfficialValuationRoots({ vehicleId, sellerLeadId: vehicle.sellerLeadId })
  try {
    await withLockedRoots(roots, (tx) =>
      officialValuationTx(tx, {
        vehicleId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        actorId: actor.id,
        mode: {
          kind: 'MANUAL',
          min,
          recommended,
          max,
          confidence,
          reason: notes ? `${reason} · ${notes}` : reason,
        },
      })
    )
  } catch (err) {
    if (isValuationError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    if (isLockError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    throw err
  }

  await recalculateMatchesForVehicle(vehicleId, db)
  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true }
}

/**
 * Ejecuta una tasación OFICIAL AUTOMÁTICA (algoritmo) sobre el vehículo (guard: Comercial/ADMIN).
 * Gated igual que la manual. Un fallo técnico del cálculo aborta la transacción (sin dejar el
 * vehículo a medias) y se registra como intento `FALLO_TECNICO`.
 */
export async function officialAutoValuation(vehicleId: string) {
  const actor = await requireAgente()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      sellerLeadId: true,
      brand: true,
      model: true,
      type: true,
      year: true,
      km: true,
      conservationState: true,
      equipment: true,
    },
  })
  if (!vehicle) return { error: { formErrors: ['Vehículo no encontrado'], fieldErrors: {} } }

  const roots = buildOfficialValuationRoots({ vehicleId, sellerLeadId: vehicle.sellerLeadId })
  let outcome: 'COMPLETADA' | 'SIN_REFERENCIA'
  try {
    const result = await withLockedRoots(roots, (tx) =>
      officialValuationTx(tx, {
        vehicleId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        actorId: actor.id,
        mode: {
          kind: 'AUTO',
          input: {
            brand: vehicle.brand,
            model: vehicle.model,
            type: vehicle.type,
            year: vehicle.year,
            km: vehicle.km,
            conservationState: vehicle.conservationState,
            equipment: (vehicle.equipment ?? {}) as EquipmentFlags,
          },
        },
      })
    )
    outcome = result.outcome
  } catch (err) {
    if (isValuationError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    if (isLockError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    // FALLO_TECNICO: el cálculo lanzó (p. ej. error de BD) y la tx revirtió (vehículo intacto).
    // Se registra el intento fuera de la transacción y se devuelve un error manejado.
    console.error('[valuation] Tasación oficial automática fallida', vehicleId, err)
    await db.vehicleValuationAttempt
      .create({
        data: {
          vehicleId,
          purpose: 'OFICIAL',
          outcome: 'FALLO_TECNICO',
          method: 'AUTO',
          errorCode: err instanceof Error ? err.name : 'UNKNOWN',
          createdById: actor.id,
        },
      })
      .catch((e) => console.error('[valuation] No se pudo registrar el intento fallido', e))
    return {
      error: {
        formErrors: ['No se pudo calcular la tasación (fallo técnico). Inténtalo de nuevo.'],
        fieldErrors: {},
      },
    }
  }

  await recalculateMatchesForVehicle(vehicleId, db)
  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true, outcome }
}
