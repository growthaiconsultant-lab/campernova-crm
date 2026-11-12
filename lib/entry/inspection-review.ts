import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { initialEquipment, inspectionField } from './inspection-equipment'
import { EQUIPMENT_OPTIONS } from '../rv-taxonomy'

export const reviewSchema = z
  .object({
    version: z.string().datetime(),
    installed: z.boolean().nullable(),
    catalogAtLoad: z.boolean().nullable(),
    result: z.enum(['PENDIENTE', 'OK', 'NECESITA_REPARACION', 'NO_APLICA']),
    ownerQuote: z.boolean(),
    notes: z.string().trim().max(2000),
  })
  .refine(
    (v) => v.installed !== false || v.result === 'NO_APLICA' || v.result === 'PENDIENTE',
    'Un elemento ausente no puede figurar como comprobado o averiado.'
  )

// Caller holds the vehicle root lock shared with other workshop edits and transitions.
export async function saveInspectionReviewTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  itemId: string,
  input: z.infer<typeof reviewSchema>
) {
  const item = await tx.workOrderChecklist.findFirst({
    where: { id: itemId, workOrderId: orderId, workOrder: { kind: 'INSPECCION_ENTRADA' } },
    include: {
      workOrder: {
        select: {
          status: true,
          vehicle: { select: { id: true, matchCatalog: true, equipment: true, heatingType: true } },
        },
      },
    },
  })
  if (!item || ['COMPLETADA', 'RECHAZADA'].includes(item.workOrder.status))
    return { error: 'La inspección ya no está abierta.' } as const
  if (item.updatedAt.toISOString() !== input.version)
    return { error: 'Este elemento ha cambiado. Actualiza la ficha antes de guardar.' } as const
  const v = item.workOrder.vehicle,
    key = inspectionField(item.item)
  // A partial inspection can leave a question open without erasing vehicle facts.
  const sync = !!key && input.installed !== null && input.installed !== item.installed
  if (sync && key) {
    if (initialEquipment(v, item.item) !== input.catalogAtLoad)
      return { error: 'El equipamiento del vehículo ha cambiado. Actualiza la ficha.' } as const
    if (!v.matchCatalog || typeof v.matchCatalog !== 'object' || Array.isArray(v.matchCatalog))
      return { error: 'Revisa el catálogo del vehículo antes de guardar.' } as const
    const catalog = { ...v.matchCatalog } as Record<string, Prisma.InputJsonValue>
    catalog[key] = { values: [input.installed ? 'Sí' : 'No'] }
    const equipment = { ...(v.equipment as Record<string, Prisma.InputJsonValue>) }
    if (EQUIPMENT_OPTIONS.some((e) => e.id === key)) {
      equipment[key] = input.installed === true
    }
    await tx.vehicle.update({
      where: { id: v.id },
      data: {
        matchCatalog: catalog,
        equipment,
        ...(key === 'heating' && {
          heatingType:
            input.installed === false
              ? 'NINGUNA'
              : v.heatingType === 'NINGUNA'
                ? null
                : v.heatingType,
        }),
      },
    })
  }
  const saved = await tx.workOrderChecklist.update({
    where: { id: item.id },
    data: {
      installed: input.installed,
      result: input.result,
      ownerQuote: input.ownerQuote,
      notes: input.notes || null,
    },
    select: { updatedAt: true },
  })
  return { version: saved.updatedAt.toISOString(), vehicleId: v.id, sync } as const
}
