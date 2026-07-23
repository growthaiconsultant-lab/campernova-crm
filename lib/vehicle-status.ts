/**
 * Núcleo transaccional del cambio manual de estado del vehículo.
 *
 * **I3A** — `updateVehicle` validaba la transición sobre una lectura previa y escribía con un
 * `update` plano: entre la lectura y el commit otro dominio podía mover el vehículo (aceptar una
 * oferta, completar una entrega) y la escritura pisaba ese cambio. La escritura pasó a ir
 * **condicionada al estado releído** (compare-and-swap) compartiendo transacción con la traza.
 *
 * **I3B** — la edición manual adopta el protocolo de raíces: `applyManualVehicleUpdateTx` corre
 * dentro de `withLockedRoots` (Vehicle → SellerLead), relee todo dentro de la transacción, rechaza
 * que la raíz haya cambiado (`VEHICLE_ROOT_CHANGED`) o que el vendedor esté archivado
 * (`LEAD_ARCHIVED`), revalida la transición sobre el estado releído y **conserva el CAS** como
 * segunda barrera. La publicación `TASADO → PUBLICADO` se coordina así con la creación/transición
 * de ofertas (que ya bloquean el vehículo) y con el archivado futuro del vendedor.
 *
 * `I3A REMOVES MANUAL RESERVATION, RELEASE AND SALE TRANSITIONS FROM updateVehicle`
 * `I3B COORDINATES MANUAL VEHICLE UPDATES AND PUBLICATION`
 * `MANUAL VEHICLE UPDATES USE THE ROOT LOCK PROTOCOL`
 * `OFFER OWNS PUBLICADO ↔ RESERVADO`
 * `DELIVERY OWNS THE TRANSITION TO VENDIDO`
 *
 * `DELIVERY CREATION AND COMPLETION REMAIN UNCOORDINATED UNTIL I3C` — el guard legal se releé bajo
 * el lock del vehículo, pero los documentos del expediente (`VehicleDocument`) son una tabla aparte
 * que otro escritor puede tocar sin bloquear el vehículo; ese límite se cierra fuera de I3B.
 * `FINAL DISCARD COORDINATION REMAINS PENDING UNTIL DELIVERY IS COORDINATED`.
 */
import type { Prisma, VehicleStatus } from '@prisma/client'
import type { LockRoot } from '@/lib/locking'
import { VEHICLE_TRANSITIONS, isValidTransition } from '@/lib/state-machine'

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

// ─── I3B: coordinación por raíces ─────────────────────────────────────────────

/**
 * Raíces a bloquear para una edición manual de vehículo: `Vehicle → SellerLead`. El vendedor solo
 * si el vehículo lo tiene; nunca una raíz con id vacío. El orden global lo fija `withLockedRoots`.
 */
export function buildVehicleUpdateRoots(p: {
  vehicleId: string
  sellerLeadId: string | null
}): LockRoot[] {
  return [
    { type: 'vehicle', id: p.vehicleId },
    ...(p.sellerLeadId ? ([{ type: 'sellerLead', id: p.sellerLeadId }] as LockRoot[]) : []),
  ]
}

export type VehicleUpdateErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'VEHICLE_ROOT_CHANGED'
  | 'SELLER_LEAD_NOT_FOUND'
  | 'LEAD_ARCHIVED'
  | 'INVALID_VEHICLE_TRANSITION'

/** Mensajes seguros: sin ids, estado interno, SQL, Prisma, stack, cause ni PII. */
export const VEHICLE_UPDATE_ERROR_MESSAGES: Record<VehicleUpdateErrorCode, string> = {
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  VEHICLE_ROOT_CHANGED:
    'Los datos del vehículo han cambiado mientras se procesaba. Inténtalo de nuevo.',
  SELLER_LEAD_NOT_FOUND: 'No se ha encontrado el vendedor del vehículo',
  LEAD_ARCHIVED: 'No se puede editar el vehículo de un vendedor archivado. Reactívalo primero.',
  INVALID_VEHICLE_TRANSITION: INVALID_VEHICLE_TRANSITION_MESSAGE,
}

/** Conflicto de negocio esperado al coordinar la edición manual. No es un error técnico. */
export class VehicleUpdateError extends Error {
  readonly code: VehicleUpdateErrorCode
  constructor(code: VehicleUpdateErrorCode) {
    super(VEHICLE_UPDATE_ERROR_MESSAGES[code])
    this.name = 'VehicleUpdateError'
    this.code = code
  }
}

export function isVehicleUpdateError(err: unknown): err is VehicleUpdateError {
  return err instanceof VehicleUpdateError
}

export type ManualVehicleUpdateParams = {
  vehicleId: string
  /** `sellerLeadId` observado en la lectura preliminar; sirve para detectar que la raíz cambió. */
  resolvedSellerLeadId: string | null
  nextStatus: VehicleStatus
  /** Campos del vehículo, incluido `status`. */
  data: Prisma.VehicleUpdateManyMutationInput
  actorId: string
  /** Construye la traza a partir del estado releído dentro de la transacción. */
  activityContent: (fromStatus: VehicleStatus) => string
}

export type ManualVehicleUpdateHooks = {
  /**
   * Validación adicional bajo el lock (p. ej. expediente legal releído con `tx`). Recibe el estado
   * releído; lanzar aborta la transacción antes de tocar nada.
   */
  beforeWrite?: (ctx: { fromStatus: VehicleStatus; tx: Prisma.TransactionClient }) => Promise<void>
  /** Sincronización determinista para tests de concurrencia (antes del CAS). */
  beforeCas?: () => Promise<void>
}

/**
 * Edición manual coordinada: relee el vehículo y su vendedor dentro de la transacción abierta por
 * `withLockedRoots`, valida raíz/archivado/transición sobre lo releído, deja que el llamante valide
 * bajo el lock (`beforeWrite`) y delega la escritura + traza en `applyVehicleUpdateTx` (CAS).
 * Debe invocarse dentro de `withLockedRoots(...)`.
 */
export async function applyManualVehicleUpdateTx(
  tx: Prisma.TransactionClient,
  p: ManualVehicleUpdateParams,
  hooks: ManualVehicleUpdateHooks = {}
): Promise<{ statusChanged: boolean; fromStatus: VehicleStatus }> {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { status: true, sellerLeadId: true },
  })
  if (!vehicle) throw new VehicleUpdateError('VEHICLE_NOT_FOUND')

  // La raíz debe seguir siendo la que se bloqueó: si el vehículo cambió de vendedor entre la
  // lectura preliminar y ahora, el lock adquirido ya no protege al vendedor correcto.
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new VehicleUpdateError('VEHICLE_ROOT_CHANGED')
  }

  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { archivedAt: true },
    })
    if (!seller) throw new VehicleUpdateError('SELLER_LEAD_NOT_FOUND')
    if (seller.archivedAt != null) throw new VehicleUpdateError('LEAD_ARCHIVED')
  }

  if (!isValidTransition(VEHICLE_TRANSITIONS, vehicle.status, p.nextStatus)) {
    throw new VehicleUpdateError('INVALID_VEHICLE_TRANSITION')
  }

  await hooks.beforeWrite?.({ fromStatus: vehicle.status, tx })

  const { statusChanged } = await applyVehicleUpdateTx(
    tx,
    {
      vehicleId: p.vehicleId,
      expectedStatus: vehicle.status,
      nextStatus: p.nextStatus,
      sellerLeadId: vehicle.sellerLeadId,
      actorId: p.actorId,
      activityContent: p.activityContent(vehicle.status),
      data: p.data,
    },
    { beforeWrite: hooks.beforeCas }
  )

  return { statusChanged, fromStatus: vehicle.status }
}
