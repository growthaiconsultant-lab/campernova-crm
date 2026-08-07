'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { db } from '@/lib/db'
import { requireCanEditReceptionCommercial, requireCanEditReceptionTechnical } from '@/lib/auth'
import { isLockError, withLockedRoots, type LockRoot } from '@/lib/locking'
import {
  commercialReceptionSchema,
  reviewReceptionSectionSchema,
  technicalReceptionSchema,
} from '@/lib/vehicle-reception/contracts'
import {
  isReceptionError,
  reviewReceptionSectionTx,
  saveCommercialReceptionTx,
  saveTechnicalReceptionTx,
} from '@/lib/vehicle-reception/service'
import { runAndSavePreliminaryValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'

export type ReceptionActionResult =
  | {
      ok: true
      revision?: number
      status: 'BORRADOR' | 'COMPLETADO'
      completedAt?: string | null
      commercialReviewed?: boolean
      technicalReviewed?: boolean
    }
  | { ok: false; error: string; conflict?: boolean }

function toActionError(error: unknown): ReceptionActionResult {
  if (error instanceof ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? 'Revisa los datos del formulario.' }
  }
  if (isReceptionError(error)) {
    return { ok: false, error: error.message, conflict: error.code === 'CONFLICT' }
  }
  if (isLockError(error)) {
    return { ok: false, error: error.message, conflict: true }
  }
  throw error
}

function revalidateReception(vehicleId: string, sellerLeadId?: string) {
  revalidatePath(`/vehiculos/${vehicleId}/recepcion`)
  revalidatePath('/taller')
  if (sellerLeadId) revalidatePath(`/vendedores/${sellerLeadId}`)
}

export async function saveCommercialReception(
  vehicleId: string,
  data: unknown
): Promise<ReceptionActionResult> {
  await requireCanEditReceptionCommercial()
  const parsed = commercialReceptionSchema.safeParse(data)
  if (!parsed.success) return toActionError(parsed.error)

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: 'Vehículo no encontrado.' }
  const roots: LockRoot[] = [
    { type: 'vehicle', id: vehicleId },
    { type: 'sellerLead', id: vehicle.sellerLeadId },
  ]

  try {
    const result = await withLockedRoots(roots, (tx) =>
      saveCommercialReceptionTx(tx, vehicleId, parsed.data)
    )
    revalidateReception(vehicleId, vehicle.sellerLeadId)
    return { ok: true, ...result }
  } catch (error) {
    return toActionError(error)
  }
}

export async function saveTechnicalReception(
  vehicleId: string,
  data: unknown
): Promise<ReceptionActionResult> {
  const actor = await requireCanEditReceptionTechnical()
  const parsed = technicalReceptionSchema.safeParse(data)
  if (!parsed.success) return toActionError(parsed.error)

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: 'Vehículo no encontrado.' }

  try {
    const result = await withLockedRoots([{ type: 'vehicle', id: vehicleId }], (tx) =>
      saveTechnicalReceptionTx(tx, vehicleId, parsed.data)
    )
    if (result.valuationInputsChanged) {
      const saved = await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })
      await runAndSavePreliminaryValuation(
        vehicleId,
        {
          brand: saved.brand,
          model: saved.model,
          type: saved.type,
          year: saved.year,
          km: saved.km,
          conservationState: saved.conservationState,
          equipment: (saved.equipment ?? {}) as Record<string, boolean>,
        },
        actor.id
      )
    }
    if (result.matchingInputsChanged) await recalculateMatchesForVehicle(vehicleId, db)
    revalidateReception(vehicleId, vehicle.sellerLeadId)
    return { ok: true, revision: result.revision, status: result.status }
  } catch (error) {
    return toActionError(error)
  }
}

export async function reviewReceptionSection(
  vehicleId: string,
  data: unknown
): Promise<ReceptionActionResult> {
  const parsed = reviewReceptionSectionSchema.safeParse(data)
  if (!parsed.success) return toActionError(parsed.error)
  const actor =
    parsed.data.section === 'commercial'
      ? await requireCanEditReceptionCommercial()
      : await requireCanEditReceptionTechnical()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: 'Vehículo no encontrado.' }

  try {
    const result = await withLockedRoots([{ type: 'vehicle', id: vehicleId }], (tx) =>
      reviewReceptionSectionTx(
        tx,
        actor.id,
        vehicleId,
        parsed.data.section,
        parsed.data.expectedRevision
      )
    )
    revalidateReception(vehicleId, vehicle.sellerLeadId)
    return { ok: true, ...result }
  } catch (error) {
    return toActionError(error)
  }
}
