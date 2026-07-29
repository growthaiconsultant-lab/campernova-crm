'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { updateSellerLeadSchema, updateVehicleSchema } from '@/lib/validators/seller-lead'
import { runAndSavePreliminaryValuation } from '@/lib/valuation/save'
import {
  officialValuationTx,
  buildOfficialValuationRoots,
  isValuationError,
  officialRequestFingerprint,
  VALUATION_ERROR_MESSAGES,
} from '@/lib/valuation'
import type { EquipmentFlags, OfficialValuationMode } from '@/lib/valuation'
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
import { unpublishVehicleTx, isUnpublishError } from '@/lib/vehicle-unpublish'
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

  // La venta y la reserva ya no son alcanzables desde aquí (I3A). Tras A3 `VEHICLE_TRANSITIONS` solo
  // ofrece `TASADO → PUBLICADO`: la primera transición `NUEVO → TASADO` la posee la tasación oficial
  // (`officialValuationTx`), y un intento genérico de alcanzar `TASADO` se rechaza bajo el lock con
  // `OFFICIAL_VALUATION_REQUIRED`. `soldAt` lo fija el propietario de la venta, `completeDeliveryTx`.
  // I3B mete la edición manual bajo `withLockedRoots`.
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
          // Guard legal de PUBLICADO, releído con `tx` bajo el lock del vehículo. Las columnas del
          // vehículo son estables (lock); los documentos son tabla aparte (límite documentado,
          // DELIVERY/expediente se cierran fuera de I3B). El guard de TASADO desapareció con A3: la
          // primera transición a TASADO ya no es alcanzable por esta vía (la posee la tasación
          // oficial), así que aquí solo queda `TASADO → PUBLICADO`.
          beforeWrite: async ({ fromStatus, tx }) => {
            const isTransitioningTo = (s: string) => status === s && fromStatus !== s
            if (!isTransitioningTo('PUBLICADO')) return
            const targetStatus = status as 'PUBLICADO'
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
    {
      brand: brand ?? null,
      model: model ?? null,
      type: type ?? null,
      year: year ?? null,
      km: km ?? null,
      conservationState,
      equipment: equipmentResolved,
    },
    actor.id
  )
  await recalculateMatchesForVehicle(vehicleId, db)

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  // PUB-1: publicar (o editar un vehículo publicado) debe refrescar el catálogo público (ISR).
  revalidatePublicCatalog()
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

function domainError(code: keyof typeof VALUATION_ERROR_MESSAGES) {
  return {
    error: {
      formErrors: [VALUATION_ERROR_MESSAGES[code]],
      fieldErrors: {} as Record<string, string[]>,
    },
  } as const
}

/**
 * Idempotencia de la tasación oficial (A3 §4), VINCULADA a la petición. Resuelve un intento previo con
 * esta `idempotencyKey` comparándolo con la petición actual (mismo vehículo + misma huella del
 * payload):
 *   · sin previo                                   → `null` (continúa el flujo normal);
 *   · previo de OTRA petición (vehículo/huella)    → error `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`
 *     (NUNCA devuelve el resultado ajeno);
 *   · previo `FALLO_TECNICO` de la MISMA petición  → error `VALUATION_ATTEMPT_FAILED`;
 *   · previo COMPLETADA/SIN_REFERENCIA de la misma → `{ ok, outcome }` (resultado ya registrado).
 * Requiere que la AUTORIZACIÓN (rol) ya se haya comprobado por el caller antes de invocarla: nunca
 * devuelve datos de un resultado previo a quien no está autorizado.
 */
async function resolvePriorOfficial(
  idempotencyKey: string,
  req: { vehicleId: string; fingerprint: string }
) {
  const prior = await db.vehicleValuationAttempt.findUnique({
    where: { idempotencyKey },
    select: { outcome: true, vehicleId: true, requestFingerprint: true },
  })
  if (!prior) return null
  if (prior.vehicleId !== req.vehicleId || prior.requestFingerprint !== req.fingerprint) {
    return domainError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
  }
  if (prior.outcome === 'FALLO_TECNICO') return domainError('VALUATION_ATTEMPT_FAILED')
  return { ok: true as const, outcome: prior.outcome as 'COMPLETADA' | 'SIN_REFERENCIA' }
}

/** Conflicto unique sobre `idempotency_key` (doble submit concurrente) → resolver contra el previo. */
function isIdempotencyConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'P2002' &&
    JSON.stringify((err as { meta?: unknown }).meta ?? '').includes('idempotency')
  )
}

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
export async function officialManualValuation(
  vehicleId: string,
  data: unknown,
  idempotencyKey: string
) {
  const actor = await requireAgente()

  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return { error: { formErrors: ['Falta la clave de idempotencia'], fieldErrors: {} } }
  }
  const parsed = officialManualSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  const { min, recommended, max, confidence, reason, notes } = parsed.data

  // Modo canónico (misma representación para la huella y para el dominio).
  const mode: OfficialValuationMode = {
    kind: 'MANUAL',
    min,
    recommended,
    max,
    confidence,
    reason: notes ? `${reason} · ${notes}` : reason,
  }
  const fingerprint = officialRequestFingerprint({ vehicleId, mode })

  // Idempotencia VINCULADA: reintento de la MISMA petición → resultado ya registrado; clave reutilizada
  // con otra petición → rechazo (nunca resultado ajeno). Autorización ya comprobada (requireAgente).
  const replay = await resolvePriorOfficial(idempotencyKey, { vehicleId, fingerprint })
  if (replay) return replay

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
        idempotencyKey,
        mode,
      })
    )
  } catch (err) {
    // Doble submit concurrente con la misma clave → resolver contra el previo (idempotencia o rechazo).
    if (isIdempotencyConflict(err)) {
      const p = await resolvePriorOfficial(idempotencyKey, { vehicleId, fingerprint })
      if (p) return p
    }
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
export async function officialAutoValuation(vehicleId: string, idempotencyKey: string) {
  const actor = await requireAgente()

  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return { error: { formErrors: ['Falta la clave de idempotencia'], fieldErrors: {} } }
  }
  // La huella AUTO identifica la petición por vehículo + modo (las cifras se derivan del vehículo).
  const fingerprint = officialRequestFingerprint({ vehicleId, mode: { kind: 'AUTO' } })

  // Idempotencia VINCULADA: reintento de la MISMA petición → resultado ya registrado; clave reutilizada
  // con otra petición (otro vehículo o AUTO↔MANUAL) → rechazo. Autorización ya comprobada (requireAgente).
  const replay = await resolvePriorOfficial(idempotencyKey, { vehicleId, fingerprint })
  if (replay) return replay

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
        idempotencyKey,
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
    // Doble submit concurrente con la misma clave → resolver contra el previo (idempotencia o rechazo).
    if (isIdempotencyConflict(err)) {
      const p = await resolvePriorOfficial(idempotencyKey, { vehicleId, fingerprint })
      if (p) return p
    }
    if (isValuationError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    if (isLockError(err)) return { error: { formErrors: [err.message], fieldErrors: {} } }
    // FALLO_TECNICO: el cálculo lanzó (p. ej. error de BD) y la tx revirtió (vehículo intacto).
    // Se registra el intento fuera de la transacción (consumiendo la clave, con su huella) y se
    // devuelve un error manejado. Un reintento con la MISMA petición → VALUATION_ATTEMPT_FAILED.
    console.error('[valuation] Tasación oficial automática fallida', vehicleId, err)
    try {
      await db.vehicleValuationAttempt.create({
        data: {
          vehicleId,
          purpose: 'OFICIAL',
          outcome: 'FALLO_TECNICO',
          method: 'AUTO',
          errorCode: err instanceof Error ? err.name : 'UNKNOWN',
          createdById: actor.id,
          idempotencyKey,
          requestFingerprint: fingerprint,
        },
      })
    } catch (writeErr) {
      // Otra petición con la misma clave registró antes su intento → resolver (idempotencia o rechazo).
      if (isIdempotencyConflict(writeErr)) {
        const p = await resolvePriorOfficial(idempotencyKey, { vehicleId, fingerprint })
        if (p) return p
      }
      console.error('[valuation] No se pudo registrar el intento fallido', writeErr)
    }
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

/**
 * PUB-1 — Retira un anuncio publicado: `PUBLICADO → TASADO` (Comercial/AGENTE + Dirección/ADMIN).
 * Transición dedicada (retirar ≠ tasar): lock/CAS, guard de ofertas activas bajo el lock, conserva
 * `publishedAt`. Invalida el catálogo público además de la ficha.
 */
export async function unpublishVehicle(
  vehicleId: string,
  input: { reason?: string | null } = {}
): Promise<{ ok: true } | { error: string }> {
  const actor = await requireAgente()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  const roots = buildVehicleUpdateRoots({ vehicleId, sellerLeadId: vehicle.sellerLeadId })

  try {
    await withLockedRoots(roots, (tx) =>
      unpublishVehicleTx(tx, {
        vehicleId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        actorId: actor.id,
        reason: input.reason?.trim() || null,
      })
    )
  } catch (err) {
    if (isUnpublishError(err)) return { error: err.message }
    if (isVehicleStatusConflict(err)) return { error: VEHICLE_STATUS_CONFLICT_MESSAGE }
    if (isLockError(err)) return { error: err.message }
    throw err
  }

  // El vehículo vuelve a ser matchable (TASADO). Revalida ficha, listado interno y CATÁLOGO PÚBLICO
  // (ISR): la lista y todas las fichas públicas `/comprar/[id]` (la ruta usa el SLUG, no el id, así que
  // se invalida el patrón de página completo).
  await recalculateMatchesForVehicle(vehicleId, db)
  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  revalidatePath('/vehiculos')
  revalidatePublicCatalog()
  return { ok: true }
}

/**
 * PUB-1: invalida el catálogo público (ISR) tras publicar/despublicar. La ficha pública vive en
 * `/comprar/[id]` con el SLUG como parámetro, así que se revalida el patrón de página completo en vez
 * de una URL concreta.
 */
function revalidatePublicCatalog() {
  revalidatePath('/comprar')
  revalidatePath('/comprar/vehiculos')
  revalidatePath('/comprar/[id]', 'page')
}
