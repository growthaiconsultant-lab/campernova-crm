/**
 * PR-A2 — Validación de la entrada oficial (núcleo transaccional).
 *
 * La entrada oficial marca que el vehículo entra formalmente en custodia: existe un contrato de
 * gestión vigente, está físicamente en la nave, tiene expediente mínimo, comercial responsable,
 * ubicación de aparcamiento y llaves registradas, y su checklist documental está clasificado. Al
 * validar se crea EXACTAMENTE UNA orden de inspección de entrada (INSPECCION_ENTRADA) para Taller.
 *
 * Protocolo (idéntico patrón a `createDeliveryTx`):
 *   1. lectura preliminar (fuera) resuelve las raíces `Vehicle → SellerLead`;
 *   2. `withLockedRoots` bloquea las raíces en orden y abre la transacción;
 *   3. relectura DENTRO de la transacción (fail-closed): `VEHICLE_ROOT_CHANGED`, `LEAD_ARCHIVED`;
 *   4. guards de estado terminal/idempotencia: `ENTRY_ALREADY_VALIDATED`, `ENTRY_ANNULLED_TERMINAL`;
 *   5. preconditions (input + documentos releídos bajo el lock);
 *   6. unicidad de orden de inspección (conteo = 1ª barrera; índice parcial = 2ª);
 *   7. CAS sobre `entryValidatedAt IS NULL` + escritura del vehículo + orden + Activity, atómico.
 *
 * `IF THE INSPECTION ORDER FAILS TO CREATE, THE WHOLE TX REVERTS` — no hay entrada sin inspección.
 * `RE-VALIDATING AN ALREADY-VALIDATED VEHICLE MUST NOT CREATE A SECOND ORDER` (CAS + índice parcial).
 * `ENTRY STATE IS READ FROM THE VEHICLE COLUMNS, NOT BY PARSING ACTIVITY`.
 *
 * Efectos externos (revalidate/KPIs) van FUERA de la transacción, en el server action.
 */
import { Prisma } from '@prisma/client'
import type { ChecklistItemCategory, VehicleDocumentCategory } from '@prisma/client'
import type { LockRoot } from '@/lib/locking'
import { PUBLICADO_REQUIRED_DOCS, isReadyForStatus } from '@/lib/vehicle-legal'
import { areCategoriesClassified, isContratoGestionSatisfied } from './checklist'
import { EntryError } from './errors'
import { getEntryChecklistSignals, getEntryLegalInput } from './prisma-deps'

/** Estados de WorkOrder en los que una orden de inspección de entrada está ACTIVA (no terminal). */
export const ACTIVE_WORKORDER_STATUSES = [
  'PENDIENTE',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADA',
  'EN_CURSO',
] as const

/** Nombre del índice único parcial de orden de inspección activa (segunda barrera en BD). */
export const ACTIVE_INSPECTION_UNIQUE_INDEX = 'work_orders_active_inspection_key'

/**
 * Categorías documentales que la entrada exige tener CLASIFICADAS (recibido o disposición explícita).
 * CONTRATO_GESTION se comprueba aparte (debe estar RECIBIDO, no vale disposición).
 */
export const ENTRY_CLASSIFIED_DOC_CATEGORIES: readonly VehicleDocumentCategory[] =
  PUBLICADO_REQUIRED_DOCS

/** Categorías que el lector debe consultar (contrato de gestión + las que se han de clasificar). */
export const ENTRY_SIGNAL_CATEGORIES: readonly VehicleDocumentCategory[] = [
  'CONTRATO_GESTION',
  ...PUBLICADO_REQUIRED_DOCS,
]

/** Checklist inicial de la orden de inspección de entrada (mismos 21 ítems del taller). */
export const INSPECTION_CHECKLIST: ReadonlyArray<{
  category: ChecklistItemCategory
  item: string
}> = [
  { category: 'MECANICA', item: 'Motor' },
  { category: 'MECANICA', item: 'Caja de cambios' },
  { category: 'MECANICA', item: 'Frenos' },
  { category: 'MECANICA', item: 'Suspensión' },
  { category: 'MECANICA', item: 'Neumáticos' },
  { category: 'MECANICA', item: 'Batería motor' },
  { category: 'MECANICA', item: 'ITV y documentación' },
  { category: 'CAMPER', item: 'Agua' },
  { category: 'CAMPER', item: 'Gas' },
  { category: 'CAMPER', item: 'Calefacción' },
  { category: 'CAMPER', item: 'Boiler' },
  { category: 'CAMPER', item: 'Nevera' },
  { category: 'CAMPER', item: 'Placas solares' },
  { category: 'CAMPER', item: 'Limpieza interior' },
  { category: 'CAMPER', item: 'Limpieza exterior' },
  { category: 'ELECTRICIDAD', item: 'Centralita' },
  { category: 'ELECTRICIDAD', item: 'Inversor' },
  { category: 'ELECTRICIDAD', item: 'Baterías auxiliares' },
  { category: 'ELECTRICIDAD', item: 'Luces' },
  { category: 'ELECTRICIDAD', item: 'Tomas 230V' },
  { category: 'ELECTRICIDAD', item: 'Cargadores' },
]

/**
 * Raíces a bloquear para validar/anular la entrada: `Vehicle → SellerLead`. El orden global lo fija
 * `withLockedRoots`. El comprador no interviene (la entrada es fase del vendedor).
 */
export function buildEntryRoots(p: { vehicleId: string; sellerLeadId: string | null }): LockRoot[] {
  return [
    { type: 'vehicle', id: p.vehicleId },
    ...(p.sellerLeadId ? ([{ type: 'sellerLead', id: p.sellerLeadId }] as LockRoot[]) : []),
  ]
}

/**
 * Detección **preliminar** de un P2002 que *podría* ser la violación del índice único parcial de
 * inspección activa. Prisma NO devuelve el nombre del índice; para esta violación devuelve
 * `modelName='WorkOrder'` + `target=['vehicle_id']`. Como en Delivery, esto solo marca «candidato»:
 * la causa se confirma con una lectura post-rollback (ver el server action) antes de traducir.
 */
export function isPotentialActiveInspectionConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false
  const meta = err.meta as { modelName?: unknown; target?: unknown } | undefined
  if (meta?.modelName !== 'WorkOrder') return false
  const target = meta?.target
  const cols = Array.isArray(target) ? target.map((c) => String(c)) : [String(target ?? '')]
  return cols.includes('vehicle_id')
}

export type ValidateEntryParams = {
  vehicleId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta que la raíz cambió. */
  resolvedSellerLeadId: string | null
  actorId: string
  /** Confirmación de presencia física del vehículo en la nave. */
  physicallyPresent: boolean
  /** Ubicación de aparcamiento en la nave (se persiste en `naveLocation`). */
  parkingLocation: string
  keysCount: number
  keysLocation: string
  keysNotes: string | null
}

export type ValidateEntryHooks = {
  /** Sincronización determinista para tests de concurrencia (antes de la escritura). */
  beforeWrite?: () => Promise<void>
}

/**
 * Valida la entrada oficial dentro de la transacción abierta por `withLockedRoots`. Debe invocarse
 * DENTRO de `withLockedRoots(buildEntryRoots(...), ...)`.
 */
export async function validateEntryTx(
  tx: Prisma.TransactionClient,
  p: ValidateEntryParams,
  hooks: ValidateEntryHooks = {}
): Promise<{ vehicleId: string; workOrderId: string }> {
  // (1) Relectura del vehículo + consistencia de raíz.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { status: true, sellerLeadId: true, entryValidatedAt: true, entryAnnulledAt: true },
  })
  if (!vehicle) throw new EntryError('VEHICLE_NOT_FOUND')
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new EntryError('VEHICLE_ROOT_CHANGED')
  }

  // (2) Vendedor: existe, no archivado, con comercial responsable asignado.
  const seller = await tx.sellerLead.findUnique({
    where: { id: vehicle.sellerLeadId },
    select: { archivedAt: true, agentId: true },
  })
  if (!seller) throw new EntryError('SELLER_LEAD_NOT_FOUND')
  if (seller.archivedAt != null) throw new EntryError('LEAD_ARCHIVED')

  // (3) Guards de estado: idempotencia + terminalidad de la anulación.
  if (vehicle.entryAnnulledAt != null) throw new EntryError('ENTRY_ANNULLED_TERMINAL')
  if (vehicle.entryValidatedAt != null) throw new EntryError('ENTRY_ALREADY_VALIDATED')

  // (4) Preconditions de input.
  if (p.physicallyPresent !== true) throw new EntryError('VEHICLE_NOT_PRESENT')
  if (seller.agentId == null) throw new EntryError('RESPONSIBLE_NOT_SET')
  if (p.parkingLocation.trim().length === 0) throw new EntryError('PARKING_LOCATION_MISSING')
  if (!(Number.isInteger(p.keysCount) && p.keysCount > 0) || p.keysLocation.trim().length === 0) {
    throw new EntryError('KEYS_NOT_RECEIVED')
  }

  // (5) Preconditions documentales (releídas bajo el lock; tablas aparte → límite documentado).
  const signals = await getEntryChecklistSignals(tx, p.vehicleId, ENTRY_SIGNAL_CATEGORIES)
  if (!isContratoGestionSatisfied(signals)) throw new EntryError('CONTRATO_GESTION_MISSING')
  if (!areCategoriesClassified(signals, ENTRY_CLASSIFIED_DOC_CATEGORIES)) {
    throw new EntryError('CHECKLIST_NOT_CLASSIFIED')
  }

  // (6) Expediente mínimo (requisitos de TASADO, vía lib/vehicle-legal).
  const legal = await getEntryLegalInput(tx, p.vehicleId)
  if (!legal) throw new EntryError('VEHICLE_NOT_FOUND')
  const docSummary = signals.map((s) => ({
    category: s.category,
    exists: s.hasActiveVersion,
  }))
  if (!isReadyForStatus(legal, 'TASADO', docSummary)) {
    throw new EntryError('EXPEDIENTE_INCOMPLETE')
  }

  // (7) Unicidad de orden de inspección: 1ª barrera por conteo (el índice parcial es la 2ª).
  const activeInspections = await tx.workOrder.count({
    where: {
      vehicleId: p.vehicleId,
      kind: 'INSPECCION_ENTRADA',
      status: { in: [...ACTIVE_WORKORDER_STATUSES] },
    },
  })
  if (activeInspections > 0) throw new EntryError('INSPECTION_ALREADY_ACTIVE')

  await hooks.beforeWrite?.()

  // (8) CAS sobre `entryValidatedAt IS NULL` — segunda barrera de idempotencia frente a carreras.
  const now = new Date()
  const cas = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, entryValidatedAt: null, entryAnnulledAt: null },
    data: {
      entryValidatedAt: now,
      entryValidatedById: p.actorId,
      naveLocation: p.parkingLocation.trim(),
      keysReceivedAt: now,
      keysReceivedById: p.actorId,
      keysCount: p.keysCount,
      keysLocation: p.keysLocation.trim(),
      keysNotes: p.keysNotes,
    },
  })
  if (cas.count === 0) throw new EntryError('ENTRY_ALREADY_VALIDATED')

  // (9) Orden de inspección de entrada (exactamente una). Si falla, toda la tx revierte.
  const workOrder = await tx.workOrder.create({
    data: {
      vehicleId: p.vehicleId,
      kind: 'INSPECCION_ENTRADA',
      description: 'Inspección de entrada del vehículo',
      checklist: {
        create: INSPECTION_CHECKLIST.map((c) => ({
          category: c.category,
          item: c.item,
          result: 'PENDIENTE' as const,
        })),
      },
    },
    select: { id: true },
  })

  // (10) Traza (NO fuente de verdad). El estado se lee de las columnas del vehículo.
  await tx.activity.createMany({
    data: [
      {
        type: 'ENTRADA_VALIDADA',
        content: 'Entrada oficial validada',
        agentId: p.actorId,
        sellerLeadId: vehicle.sellerLeadId,
      },
      {
        type: 'LLAVES_REGISTRADAS',
        content: `Llaves registradas: ${p.keysCount} · ${p.keysLocation.trim()}`,
        agentId: p.actorId,
        sellerLeadId: vehicle.sellerLeadId,
      },
      {
        type: 'ORDEN_INSPECCION_CREADA',
        content: 'Orden de inspección de entrada creada',
        agentId: p.actorId,
        sellerLeadId: vehicle.sellerLeadId,
      },
    ],
  })

  return { vehicleId: p.vehicleId, workOrderId: workOrder.id }
}
