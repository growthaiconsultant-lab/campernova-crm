/**
 * PR I3A — Núcleo transaccional del cambio manual de estado del vehículo.
 *
 * `updateVehicle` validaba la transición sobre una lectura previa y escribía con un `update`
 * plano: entre la lectura y el commit otro dominio podía mover el vehículo (aceptar una oferta,
 * completar una entrega) y la escritura pisaba ese cambio. Aquí la escritura va **condicionada al
 * estado releído** (compare-and-swap) y comparte transacción con la traza.
 *
 * `I3A REMOVES MANUAL RESERVATION, RELEASE AND SALE TRANSITIONS FROM updateVehicle`
 * `OFFER OWNS PUBLICADO ↔ RESERVADO`
 * `DELIVERY OWNS THE TRANSITION TO VENDIDO`
 *
 * Este módulo **no** adquiere locks de raíz: I3A se limita a impedir invasiones manuales y a
 * cerrar el TOCTOU de `updateVehicle`. La coordinación completa llega después —
 * `DISCARD BLOCKERS AND ROOT LOCK COORDINATION REMAIN PENDING UNTIL I3B`.
 */
import type { Prisma, VehicleStatus } from '@prisma/client'

/** Mensajes visibles: sin ids, sin estado interno, sin SQL, sin Prisma, sin stack, sin PII. */
export const VEHICLE_STATUS_CONFLICT_MESSAGE =
  'El estado del vehículo ha cambiado. Recarga la ficha antes de intentarlo de nuevo.'
export const INVALID_VEHICLE_TRANSITION_MESSAGE = 'Este cambio de estado no está permitido.'

/**
 * El CAS no encontró el vehículo en el estado esperado: otro proceso lo movió entre la relectura
 * y la escritura. Es un conflicto de negocio esperado, no un error técnico.
 */
export class VehicleStatusConflictError extends Error {
  constructor() {
    super(VEHICLE_STATUS_CONFLICT_MESSAGE)
    this.name = 'VehicleStatusConflictError'
  }
}

export function isVehicleStatusConflict(err: unknown): err is VehicleStatusConflictError {
  return err instanceof VehicleStatusConflictError
}

export type ApplyVehicleUpdateParams = {
  vehicleId: string
  /** Estado leído dentro del flujo; el CAS exige que siga siendo este. */
  expectedStatus: VehicleStatus
  nextStatus: VehicleStatus
  /** Campos del vehículo, incluido `status`. */
  data: Prisma.VehicleUpdateManyMutationInput
  sellerLeadId: string | null
  actorId: string
  /** Contenido de la traza; solo se escribe si el estado cambia. */
  activityContent: string
}

/** Puntos de sincronización deterministas para los tests de concurrencia. */
export type VehicleUpdateHooks = {
  beforeWrite?: () => Promise<void>
  beforeActivity?: () => Promise<void>
}

/**
 * Escribe el vehículo y, si el estado cambia, su traza — en la misma transacción.
 * Debe invocarse dentro de `db.$transaction(...)`.
 */
export async function applyVehicleUpdateTx(
  tx: Prisma.TransactionClient,
  p: ApplyVehicleUpdateParams,
  hooks: VehicleUpdateHooks = {}
): Promise<{ statusChanged: boolean }> {
  await hooks.beforeWrite?.()

  // Compare-and-swap: si el vehículo ya no está en el estado sobre el que se validó la
  // transición, `count === 0` → conflicto y la transacción entera revierte.
  const res = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, status: p.expectedStatus },
    data: p.data,
  })
  if (res.count === 0) throw new VehicleStatusConflictError()

  const statusChanged = p.nextStatus !== p.expectedStatus
  if (statusChanged) {
    await hooks.beforeActivity?.()
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: p.activityContent,
        agentId: p.actorId,
        sellerLeadId: p.sellerLeadId,
      },
    })
  }

  return { statusChanged }
}
