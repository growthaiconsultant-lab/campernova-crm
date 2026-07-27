/**
 * Adaptadores Prisma (read-only) de la entrada oficial (PR-A2).
 *
 * Tipados sobre `Prisma.TransactionClient` para poder correr DENTRO de la transacción de
 * `withLockedRoots` (releen documentos/expediente bajo el lock del vehículo). `PrismaClient` también
 * satisface el tipo, así que el mismo lector sirve para lecturas fuera de transacción (UI/checklist).
 *
 * Los documentos y el expediente viven en tablas aparte del vehículo: el lock de fila del vehículo
 * NO los serializa. Releerlos aquí acerca la evaluación al momento de la escritura, pero una carrera
 * de subida de documento concurrente sigue siendo posible — límite documentado (igual que el guard
 * legal de `updateVehicle`/`delivery-precondition`).
 */
import type { Prisma, VehicleDocumentCategory } from '@prisma/client'
import type { OfficialEntryExpedienteInput } from './entry-expediente'
import type { CategoryDocSignal } from './checklist'

/** Cliente mínimo que necesita el lector: delegados de solo lectura. `tx` y `PrismaClient` valen. */
export type EntryReadClient = Prisma.TransactionClient

/**
 * Señales documentales por categoría: existencia de una versión ACTIVE (documento vigente) y la
 * disposición explícita registrada, si la hay. No decide estados: eso lo hace `checklist.ts`.
 */
export async function getEntryChecklistSignals(
  client: EntryReadClient,
  vehicleId: string,
  categories: readonly VehicleDocumentCategory[]
): Promise<CategoryDocSignal[]> {
  const cats = [...categories]
  const [docs, dispositions] = await Promise.all([
    client.vehicleDocument.findMany({
      where: { vehicleId, category: { in: cats } },
      select: {
        category: true,
        versions: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
      },
    }),
    client.vehicleDocumentRequirementDisposition.findMany({
      where: { vehicleId, category: { in: cats } },
      select: { category: true, disposition: true },
    }),
  ])

  const active = new Set<VehicleDocumentCategory>()
  for (const d of docs) if (d.versions.length > 0) active.add(d.category)
  const dispByCategory = new Map(dispositions.map((d) => [d.category, d.disposition]))

  return cats.map((category) => ({
    category,
    hasActiveVersion: active.has(category),
    disposition: dispByCategory.get(category) ?? null,
  }))
}

/**
 * Carga el expediente mínimo de ENTRADA OFICIAL (política propia `isReadyForOfficialEntry`, NO TASADO).
 * Solo lee la identificación del vehículo (matrícula); no carga precio, fotos ni datos comerciales,
 * porque la entrada no los exige. Devuelve null si el vehículo no existe.
 */
export async function getEntryExpedienteInput(
  client: EntryReadClient,
  vehicleId: string
): Promise<OfficialEntryExpedienteInput | null> {
  const vehicle = await client.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true },
  })
  if (!vehicle) return null
  return { plate: vehicle.plate }
}
