'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { buildTrustPassport } from '@/lib/trust-passport'
import { getTrustPassportInput } from '@/lib/trust-passport/prisma-deps'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { KPI_EVENTS } from '@/lib/kpi/events'

/**
 * Block 20: otorga el sello "Verificado por CampersNova" a un vehículo.
 * Solo si el pasaporte de confianza es elegible (sin bloqueos). Registra el
 * sello en el vehículo + traza en el timeline del vendedor.
 */
export async function grantTrustSeal(
  vehicleId: string,
  notes?: string
): Promise<{ error?: string }> {
  const actor = await requireAgente()

  const input = await getTrustPassportInput(db, vehicleId)
  if (!input) return { error: 'Vehículo no encontrado' }

  const passport = buildTrustPassport(input)
  if (!passport.eligibleForSeal) {
    return { error: `No se puede sellar: ${passport.blockers.join('; ')}` }
  }

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true, brand: true, model: true, trustVerifiedAt: true },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }
  if (vehicle.trustVerifiedAt) return {} // idempotente: ya está sellado

  await db.$transaction([
    db.vehicle.update({
      where: { id: vehicleId },
      data: {
        trustVerifiedAt: new Date(),
        trustVerifiedById: actor.id,
        trustNotes: notes?.trim().slice(0, 500) || null,
      },
    }),
    db.activity.create({
      data: {
        type: 'TRUST_SELLO_OTORGADO',
        content: `Sello "Verificado por CampersNova" otorgado a ${vehicle.brand} ${vehicle.model}`,
        agentId: actor.id,
        sellerLeadId: vehicle.sellerLeadId,
      },
    }),
  ])

  await emitKpiEvent({
    event: KPI_EVENTS.TRUST_PASSPORT_GRANTED,
    entityType: 'vehicle',
    entityId: vehicleId,
    actorUserId: actor.id,
    source: 'ui',
  })

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  revalidatePath('/vendedores')
  return {}
}

/** Block 20: revoca el sello (p.ej. tras detectar un problema). */
export async function revokeTrustSeal(vehicleId: string): Promise<{ error?: string }> {
  const actor = await requireAgente()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true, brand: true, model: true, trustVerifiedAt: true },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }
  if (!vehicle.trustVerifiedAt) return {} // ya no está sellado

  await db.$transaction([
    db.vehicle.update({
      where: { id: vehicleId },
      data: { trustVerifiedAt: null, trustVerifiedById: null, trustNotes: null },
    }),
    db.activity.create({
      data: {
        type: 'TRUST_SELLO_REVOCADO',
        content: `Sello de confianza revocado en ${vehicle.brand} ${vehicle.model}`,
        agentId: actor.id,
        sellerLeadId: vehicle.sellerLeadId,
      },
    }),
  ])

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  revalidatePath('/vendedores')
  return {}
}
