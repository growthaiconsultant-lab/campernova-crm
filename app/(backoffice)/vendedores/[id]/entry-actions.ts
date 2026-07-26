'use server'

/**
 * PR-A2 — Server actions de la entrada oficial del vehículo.
 *
 * Cablean prisma + revalidación ALREDEDOR del núcleo puro de `lib/entry`. La transacción (locks +
 * escritura) vive en `validateEntryTx`/`annulEntryTx`; aquí se hace la lectura preliminar de raíces,
 * se traduce el P2002 del índice parcial de inspección y se revalidan las rutas FUERA de la
 * transacción.
 *
 * Permisos: validar entrada = Comercial (AGENTE/ADMIN); anular = Dirección (ADMIN);
 * disposición documental = Comercial (AGENTE/ADMIN).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireAgente } from '@/lib/auth'
import { withLockedRoots, isLockError } from '@/lib/locking'
import {
  validateEntryTx,
  annulEntryTx,
  buildEntryRoots,
  isEntryError,
  isPotentialActiveInspectionConflict,
  ACTIVE_WORKORDER_STATUSES,
  ENTRY_ERROR_MESSAGES,
} from '@/lib/entry'
import type { EntryAnnulmentReason, VehicleDocumentCategory } from '@prisma/client'

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

// ─── Schemas ──────────────────────────────────────────────────────────────────

const validateEntrySchema = z.object({
  vehicleId: z.string().min(1),
  physicallyPresent: z.coerce.boolean(),
  parkingLocation: z.string().trim().min(1, 'Indica la ubicación de aparcamiento'),
  keysCount: z.coerce.number().int().positive('Registra al menos una llave'),
  keysLocation: z.string().trim().min(1, 'Indica dónde se guardan las llaves'),
  keysNotes: z.string().trim().max(1000).optional().nullable(),
})

const ANNULMENT_REASONS: [EntryAnnulmentReason, ...EntryAnnulmentReason[]] = [
  'PROPIETARIO_DESISTE',
  'VEHICULO_RETIRADO',
  'CONTRATO_ANULADO',
  'DATOS_DOCUMENTACION_INVALIDOS',
  'VEHICULO_NO_ACEPTADO',
  'DUPLICADO',
  'ERROR_ADMINISTRATIVO',
  'OTRO',
]

const annulEntrySchema = z.object({
  vehicleId: z.string().min(1),
  reason: z.enum(ANNULMENT_REASONS),
  notes: z.string().trim().max(1000).optional().nullable(),
})

const DISPOSITIONS = ['PENDIENTE', 'NO_DISPONIBLE', 'NO_APLICABLE'] as const
const setDispositionSchema = z.object({
  vehicleId: z.string().min(1),
  category: z.string().min(1),
  // null / '' → limpia la disposición (vuelve a SIN_CLASIFICAR si no hay documento vigente).
  disposition: z.enum(DISPOSITIONS).nullable().optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateEntry(sellerLeadId: string | null) {
  if (sellerLeadId) revalidatePath(`/vendedores/${sellerLeadId}`)
  revalidatePath('/vehiculos')
  revalidatePath('/taller')
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Valida la entrada oficial del vehículo (guard: Comercial / AGENTE). */
export async function validateEntry(
  formData: unknown
): Promise<ActionResult<{ vehicleId: string }>> {
  const actor = await requireAgente()

  const parsed = validateEntrySchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Lectura preliminar: solo resuelve la raíz vendedor. Toda decisión se relee dentro de la tx.
  const vehicle = await db.vehicle.findUnique({
    where: { id: input.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: ENTRY_ERROR_MESSAGES.VEHICLE_NOT_FOUND }

  const roots = buildEntryRoots({ vehicleId: input.vehicleId, sellerLeadId: vehicle.sellerLeadId })

  try {
    await withLockedRoots(roots, (tx) =>
      validateEntryTx(tx, {
        vehicleId: input.vehicleId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        actorId: actor.id,
        physicallyPresent: input.physicallyPresent,
        parkingLocation: input.parkingLocation,
        keysCount: input.keysCount,
        keysLocation: input.keysLocation,
        keysNotes: input.keysNotes ?? null,
      })
    )
  } catch (err) {
    if (isEntryError(err)) return { ok: false, error: err.message }
    if (isLockError(err)) return { ok: false, error: err.message }
    // P2002 del índice único parcial de inspección activa. Prisma NO devuelve el nombre del índice
    // (solo modelName='WorkOrder' + target=['vehicle_id']); la metadata marca el ÁREA y una lectura
    // post-rollback confirma la causa real ANTES de traducir. Fuera de la tx abortada (cliente global).
    if (isPotentialActiveInspectionConflict(err)) {
      const active = await db.workOrder.count({
        where: {
          vehicleId: input.vehicleId,
          kind: 'INSPECCION_ENTRADA',
          status: { in: [...ACTIVE_WORKORDER_STATUSES] },
        },
      })
      if (active > 0) {
        return { ok: false, error: ENTRY_ERROR_MESSAGES.INSPECTION_ALREADY_ACTIVE }
      }
    }
    throw err
  }

  revalidateEntry(vehicle.sellerLeadId)
  return { ok: true, data: { vehicleId: input.vehicleId } }
}

/** Anula la entrada oficial (guard: Dirección / ADMIN). Terminal, sin revalidación. */
export async function annulEntry(formData: unknown): Promise<ActionResult<{ vehicleId: string }>> {
  const actor = await requireAdmin()

  const parsed = annulEntrySchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Validación temprana (la barrera de dominio definitiva vive en el núcleo, bajo el lock).
  if (input.reason === 'OTRO' && !input.notes) {
    return { ok: false, error: ENTRY_ERROR_MESSAGES.ANNULMENT_NOTES_REQUIRED }
  }

  const vehicle = await db.vehicle.findUnique({
    where: { id: input.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: ENTRY_ERROR_MESSAGES.VEHICLE_NOT_FOUND }

  const roots = buildEntryRoots({ vehicleId: input.vehicleId, sellerLeadId: vehicle.sellerLeadId })

  try {
    await withLockedRoots(roots, (tx) =>
      annulEntryTx(tx, {
        vehicleId: input.vehicleId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        actorId: actor.id,
        reason: input.reason,
        notes: input.notes ?? null,
      })
    )
  } catch (err) {
    if (isEntryError(err)) return { ok: false, error: err.message }
    if (isLockError(err)) return { ok: false, error: err.message }
    throw err
  }

  revalidateEntry(vehicle.sellerLeadId)
  return { ok: true, data: { vehicleId: input.vehicleId } }
}

/**
 * Fija o limpia la disposición de una categoría documental (guard: Comercial / AGENTE).
 * `RECIBIDO`/`SIN_CLASIFICAR` NUNCA se persisten: son derivados. Aquí solo se persiste una
 * disposición explícita (PENDIENTE/NO_DISPONIBLE/NO_APLICABLE) o se borra la fila.
 */
export async function setDocumentDisposition(formData: unknown): Promise<ActionResult> {
  const actor = await requireAgente()

  const parsed = setDispositionSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const { vehicleId, disposition } = parsed.data
  const category = parsed.data.category as VehicleDocumentCategory

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: ENTRY_ERROR_MESSAGES.VEHICLE_NOT_FOUND }

  await db.$transaction(async (tx) => {
    if (disposition == null) {
      await tx.vehicleDocumentRequirementDisposition.deleteMany({ where: { vehicleId, category } })
    } else {
      await tx.vehicleDocumentRequirementDisposition.upsert({
        where: { vehicleId_category: { vehicleId, category } },
        create: { vehicleId, category, disposition, updatedById: actor.id },
        update: { disposition, updatedById: actor.id },
      })
    }
    await tx.activity.create({
      data: {
        type: 'DISPOSICION_DOCUMENTAL_ACTUALIZADA',
        content: `Disposición documental · ${category}: ${disposition ?? 'sin clasificar'}`,
        agentId: actor.id,
        sellerLeadId: vehicle.sellerLeadId,
      },
    })
  })

  revalidateEntry(vehicle.sellerLeadId)
  return { ok: true }
}
