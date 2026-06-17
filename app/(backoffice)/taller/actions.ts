'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireCanEditTaller, requireCanViewTaller } from '@/lib/auth'
import type { WorkOrderStatus } from '@prisma/client'
import { suggestSchedule, DEFAULT_HOURS_PER_DAY } from '@/lib/taller/scheduling'
import { getMechanicBacklogHours } from '@/lib/taller/prisma-deps'

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

// ─── Checklist inicial (21 ítems) ────────────────────────────────────────────

const INITIAL_CHECKLIST = [
  { category: 'MECANICA' as const, item: 'Motor' },
  { category: 'MECANICA' as const, item: 'Caja de cambios' },
  { category: 'MECANICA' as const, item: 'Frenos' },
  { category: 'MECANICA' as const, item: 'Suspensión' },
  { category: 'MECANICA' as const, item: 'Neumáticos' },
  { category: 'MECANICA' as const, item: 'Batería motor' },
  { category: 'CAMPER' as const, item: 'Agua' },
  { category: 'CAMPER' as const, item: 'Gas' },
  { category: 'CAMPER' as const, item: 'Calefacción' },
  { category: 'CAMPER' as const, item: 'Boiler' },
  { category: 'CAMPER' as const, item: 'Nevera' },
  { category: 'CAMPER' as const, item: 'Placas solares' },
  { category: 'ELECTRICIDAD' as const, item: 'Centralita' },
  { category: 'ELECTRICIDAD' as const, item: 'Inversor' },
  { category: 'ELECTRICIDAD' as const, item: 'Baterías auxiliares' },
  { category: 'ELECTRICIDAD' as const, item: 'Luces' },
  { category: 'ELECTRICIDAD' as const, item: 'Tomas 230V' },
  { category: 'ELECTRICIDAD' as const, item: 'Cargadores' },
  { category: 'CAMPER' as const, item: 'Limpieza interior' },
  { category: 'CAMPER' as const, item: 'Limpieza exterior' },
  { category: 'MECANICA' as const, item: 'ITV y documentación' },
]

// ─── Transiciones válidas ─────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PENDIENTE: ['EN_DIAGNOSTICO', 'RECHAZADA'],
  EN_DIAGNOSTICO: ['PRESUPUESTADA', 'RECHAZADA'],
  PRESUPUESTADA: ['EN_CURSO', 'RECHAZADA'],
  EN_CURSO: ['COMPLETADA', 'RECHAZADA'],
  COMPLETADA: [],
  RECHAZADA: [],
}

function isValidTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

function revalidateTaller(woId?: string) {
  revalidatePath('/taller')
  if (woId) revalidatePath(`/taller/${woId}`)
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createWorkOrderSchema = z.object({
  vehicleId: z.string().min(1),
  description: z.string().min(1, 'Descripción requerida').trim(),
  assignedToId: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().positive().optional().nullable(),
  estimatedCost: z.coerce.number().positive().optional().nullable(),
  approvalLimit: z.coerce.number().positive().default(500),
  notes: z.string().trim().optional().nullable(),
  // Planificación opcional al crear (ventana reservada en la agenda).
  scheduledStart: z.string().optional().nullable(),
  scheduledEnd: z.string().optional().nullable(),
})

const scheduleWorkOrderSchema = z.object({
  assignedToId: z.string().min(1, 'Asigna un responsable para planificar'),
  scheduledStart: z.string().min(1, 'Fecha de inicio requerida'),
  scheduledEnd: z.string().min(1, 'Fecha de fin requerida'),
})

const timeEntrySchema = z.object({
  hours: z.coerce.number().positive('Las horas deben ser positivas'),
  hourlyRate: z.coerce.number().positive().default(30),
  description: z.string().min(1, 'Descripción requerida').trim(),
  workDate: z.string().min(1, 'Fecha requerida'),
})

const partSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').trim(),
  quantity: z.coerce.number().int().positive().default(1),
  unitCost: z.coerce.number().positive('El coste debe ser positivo'),
  supplier: z.string().trim().optional().nullable(),
  invoiceUrl: z.string().url().optional().or(z.literal('')).nullable(),
})

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createWorkOrder(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCanViewTaller()

  const parsed = createWorkOrderSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const {
    vehicleId,
    description,
    assignedToId,
    estimatedHours,
    estimatedCost,
    approvalLimit,
    notes,
    scheduledStart,
    scheduledEnd,
  } = parsed.data

  // Determinar approvalLevel inicial
  const approvalLevel =
    estimatedCost && estimatedCost > approvalLimit ? 'REQUIERE_CEO' : 'NO_REQUIERE'

  // Obtener sellerLeadId para el activity log
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true, brand: true, model: true },
  })
  if (!vehicle) return { ok: false, error: 'Vehículo no encontrado' }

  const workOrder = await db.workOrder.create({
    data: {
      vehicleId,
      description,
      assignedToId: assignedToId ?? null,
      estimatedHours: estimatedHours ?? null,
      estimatedCost: estimatedCost ?? null,
      approvalLimit,
      approvalLevel,
      notes: notes ?? null,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
      checklist: {
        create: INITIAL_CHECKLIST.map((item) => ({
          category: item.category,
          item: item.item,
          result: 'PENDIENTE',
        })),
      },
    },
  })

  await db.activity.create({
    data: {
      type: 'ORDEN_TALLER_CREADA',
      content: `Orden de taller creada: ${description}${estimatedCost ? ` · Coste estimado: ${Number(estimatedCost).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : ''}`,
      agentId: actor.id,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })

  revalidateTaller(workOrder.id)
  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true, data: { id: workOrder.id } }
}

export async function updateWorkOrderStatus(
  woId: string,
  newStatus: WorkOrderStatus
): Promise<ActionResult> {
  const actor = await requireCanEditTaller()

  const wo = await db.workOrder.findUnique({
    where: { id: woId },
    select: {
      status: true,
      approvalLevel: true,
      vehicleId: true,
      vehicle: { select: { sellerLeadId: true } },
      timeEntries: { select: { hours: true, hourlyRate: true } },
      parts: { select: { quantity: true, unitCost: true } },
    },
  })
  if (!wo) return { ok: false, error: 'Orden no encontrada' }

  if (!isValidTransition(wo.status, newStatus)) {
    return { ok: false, error: `Transición ${wo.status} → ${newStatus} no permitida.` }
  }

  // Pasar a EN_CURSO requiere aprobación o que no la necesite
  if (
    newStatus === 'EN_CURSO' &&
    wo.approvalLevel !== 'NO_REQUIERE' &&
    wo.approvalLevel !== 'APROBADA_CEO'
  ) {
    return { ok: false, error: 'La orden requiere aprobación del CEO antes de empezar.' }
  }

  const now = new Date()
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'EN_CURSO') updateData.startedAt = now
  if (newStatus === 'COMPLETADA') updateData.completedAt = now

  let activityType: 'ORDEN_TALLER_COMPLETADA' | 'ORDEN_TALLER_RECHAZADA' | 'CAMBIO_ESTADO' =
    'CAMBIO_ESTADO'
  if (newStatus === 'COMPLETADA') activityType = 'ORDEN_TALLER_COMPLETADA'
  if (newStatus === 'RECHAZADA') activityType = 'ORDEN_TALLER_RECHAZADA'

  const costsToCreate: {
    category: 'MANO_OBRA_TALLER' | 'PIEZAS'
    description: string
    amount: number
  }[] = []

  if (newStatus === 'COMPLETADA') {
    // Generar VehicleCost desde time entries
    const totalHours = wo.timeEntries.reduce(
      (sum, e) => sum + Number(e.hours) * Number(e.hourlyRate),
      0
    )
    if (totalHours > 0) {
      costsToCreate.push({
        category: 'MANO_OBRA_TALLER',
        description: `Mano de obra taller (orden ${woId.slice(0, 8)})`,
        amount: totalHours,
      })
    }

    const totalParts = wo.parts.reduce((sum, p) => sum + p.quantity * Number(p.unitCost), 0)
    if (totalParts > 0) {
      costsToCreate.push({
        category: 'PIEZAS',
        description: `Piezas y repuestos (orden ${woId.slice(0, 8)})`,
        amount: totalParts,
      })
    }
  }

  await db.$transaction([
    db.workOrder.update({ where: { id: woId }, data: updateData }),
    ...costsToCreate.map((c) =>
      db.vehicleCost.create({
        data: {
          vehicleId: wo.vehicleId,
          category: c.category,
          description: c.description,
          amount: c.amount,
          createdById: actor.id,
          workOrderId: woId,
        },
      })
    ),
    db.activity.create({
      data: {
        type: activityType,
        content: `Orden de taller: ${wo.status} → ${newStatus}`,
        agentId: actor.id,
        sellerLeadId: wo.vehicle.sellerLeadId,
      },
    }),
  ])

  revalidateTaller(woId)
  revalidatePath(`/vendedores/${wo.vehicle.sellerLeadId}`)
  return { ok: true }
}

export async function updateChecklistItem(
  checklistItemId: string,
  data: { result: string; notes?: string | null; photos?: string[] }
): Promise<ActionResult> {
  await requireCanEditTaller()

  await db.workOrderChecklist.update({
    where: { id: checklistItemId },
    data: {
      result: data.result as 'PENDIENTE' | 'OK' | 'NECESITA_REPARACION' | 'NO_APLICA',
      notes: data.notes ?? null,
      photos: data.photos ?? [],
    },
  })

  const item = await db.workOrderChecklist.findUnique({
    where: { id: checklistItemId },
    select: { workOrderId: true },
  })
  if (item) revalidateTaller(item.workOrderId)
  return { ok: true }
}

export async function addTimeEntry(woId: string, formData: unknown): Promise<ActionResult> {
  const actor = await requireCanEditTaller()

  const parsed = timeEntrySchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const wo = await db.workOrder.findUnique({ where: { id: woId }, select: { status: true } })
  if (!wo) return { ok: false, error: 'Orden no encontrada' }
  if (wo.status === 'COMPLETADA' || wo.status === 'RECHAZADA') {
    return { ok: false, error: 'No se puede imputar horas a una orden cerrada.' }
  }

  const { hours, hourlyRate, description, workDate } = parsed.data

  await db.workOrderTimeEntry.create({
    data: {
      workOrderId: woId,
      workerId: actor.id,
      hours,
      hourlyRate,
      description,
      workDate: new Date(workDate),
    },
  })

  revalidateTaller(woId)
  return { ok: true }
}

export async function deleteTimeEntry(entryId: string): Promise<ActionResult> {
  const actor = await requireCanEditTaller()

  const entry = await db.workOrderTimeEntry.findUnique({
    where: { id: entryId },
    select: { workerId: true, workOrderId: true },
  })
  if (!entry) return { ok: false, error: 'Entrada no encontrada' }

  if (entry.workerId !== actor.id && actor.role !== 'ADMIN') {
    return { ok: false, error: 'Solo el trabajador o un admin puede eliminar esta entrada.' }
  }

  await db.workOrderTimeEntry.delete({ where: { id: entryId } })
  revalidateTaller(entry.workOrderId)
  return { ok: true }
}

export async function addPart(woId: string, formData: unknown): Promise<ActionResult> {
  await requireCanEditTaller()

  const parsed = partSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { name, quantity, unitCost, supplier, invoiceUrl } = parsed.data

  await db.workOrderPart.create({
    data: {
      workOrderId: woId,
      name,
      quantity,
      unitCost,
      supplier: supplier ?? null,
      invoiceUrl: invoiceUrl ?? null,
    },
  })

  revalidateTaller(woId)
  return { ok: true }
}

export async function deletePart(partId: string): Promise<ActionResult> {
  await requireAdmin()

  const part = await db.workOrderPart.findUnique({
    where: { id: partId },
    select: { workOrderId: true },
  })
  if (!part) return { ok: false, error: 'Pieza no encontrada' }

  await db.workOrderPart.delete({ where: { id: partId } })
  revalidateTaller(part.workOrderId)
  return { ok: true }
}

export async function approveWorkOrder(woId: string): Promise<ActionResult> {
  const actor = await requireAdmin()

  const wo = await db.workOrder.findUnique({
    where: { id: woId },
    select: { approvalLevel: true, vehicle: { select: { sellerLeadId: true } } },
  })
  if (!wo) return { ok: false, error: 'Orden no encontrada' }

  await db.$transaction([
    db.workOrder.update({
      where: { id: woId },
      data: { approvalLevel: 'APROBADA_CEO', approvedById: actor.id, approvedAt: new Date() },
    }),
    db.activity.create({
      data: {
        type: 'ORDEN_TALLER_APROBADA',
        content: 'Orden de taller aprobada por CEO.',
        agentId: actor.id,
        sellerLeadId: wo.vehicle.sellerLeadId,
      },
    }),
  ])

  revalidateTaller(woId)
  revalidatePath(`/vendedores/${wo.vehicle.sellerLeadId}`)
  return { ok: true }
}

export async function rejectWorkOrder(woId: string, reason?: string): Promise<ActionResult> {
  const actor = await requireAdmin()

  const wo = await db.workOrder.findUnique({
    where: { id: woId },
    select: { vehicle: { select: { sellerLeadId: true } } },
  })
  if (!wo) return { ok: false, error: 'Orden no encontrada' }

  await db.$transaction([
    db.workOrder.update({
      where: { id: woId },
      data: { approvalLevel: 'RECHAZADA_CEO', approvedById: actor.id, approvedAt: new Date() },
    }),
    db.activity.create({
      data: {
        type: 'ORDEN_TALLER_RECHAZADA',
        content: `Orden de taller rechazada por CEO.${reason ? ` Motivo: ${reason}` : ''}`,
        agentId: actor.id,
        sellerLeadId: wo.vehicle.sellerLeadId,
      },
    }),
  ])

  revalidateTaller(woId)
  revalidatePath(`/vendedores/${wo.vehicle.sellerLeadId}`)
  return { ok: true }
}

export async function updateEstimatedCost(
  woId: string,
  estimatedCost: number
): Promise<ActionResult> {
  await requireCanEditTaller()

  const wo = await db.workOrder.findUnique({
    where: { id: woId },
    select: { approvalLimit: true },
  })
  if (!wo) return { ok: false, error: 'Orden no encontrada' }

  const approvalLevel = estimatedCost > Number(wo.approvalLimit) ? 'REQUIERE_CEO' : 'NO_REQUIERE'

  await db.workOrder.update({
    where: { id: woId },
    data: { estimatedCost, approvalLevel },
  })

  revalidateTaller(woId)
  return { ok: true }
}

// ─── Planificación / agenda ────────────────────────────────────────────────────

/**
 * Sugiere la ventana de trabajo (fecha de inicio y de entrega estimada) para una orden,
 * teniendo en cuenta la carga en cola del responsable. Lo usa el formulario antes de confirmar.
 */
export async function suggestScheduleForOrder(input: {
  assignedToId?: string | null
  estimatedHours: number
  excludeWorkOrderId?: string
}): Promise<ActionResult<{ start: string; end: string; workingDaysNeeded: number }>> {
  await requireCanViewTaller()

  const hours = Number(input.estimatedHours)
  if (!hours || hours <= 0) {
    return { ok: false, error: 'Indica las horas previstas para poder sugerir una fecha.' }
  }

  const backlogHours = input.assignedToId
    ? await getMechanicBacklogHours(db, input.assignedToId, input.excludeWorkOrderId)
    : 0

  const result = suggestSchedule({
    plannedHours: hours,
    backlogHours,
    from: new Date(),
    hoursPerDay: DEFAULT_HOURS_PER_DAY,
  })

  return {
    ok: true,
    data: {
      start: result.start.toISOString(),
      end: result.end.toISOString(),
      workingDaysNeeded: result.workingDaysNeeded,
    },
  }
}

/**
 * Reserva (planifica) una orden en la agenda: responsable + ventana de trabajo.
 */
export async function scheduleWorkOrder(woId: string, formData: unknown): Promise<ActionResult> {
  await requireCanEditTaller()

  const parsed = scheduleWorkOrderSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { assignedToId, scheduledStart, scheduledEnd } = parsed.data

  const wo = await db.workOrder.findUnique({
    where: { id: woId },
    select: { status: true, vehicle: { select: { sellerLeadId: true } } },
  })
  if (!wo) return { ok: false, error: 'Orden no encontrada' }
  if (wo.status === 'COMPLETADA' || wo.status === 'RECHAZADA') {
    return { ok: false, error: 'No se puede planificar una orden cerrada.' }
  }

  const start = new Date(scheduledStart)
  const end = new Date(scheduledEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'Fechas inválidas.' }
  }
  if (end < start) {
    return { ok: false, error: 'La fecha de fin no puede ser anterior al inicio.' }
  }

  await db.workOrder.update({
    where: { id: woId },
    data: { assignedToId, scheduledStart: start, scheduledEnd: end },
  })

  revalidateTaller(woId)
  revalidatePath('/taller/agenda')
  if (wo.vehicle.sellerLeadId) revalidatePath(`/vendedores/${wo.vehicle.sellerLeadId}`)
  return { ok: true }
}
