'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireCanEditTaller, requireCanViewTaller } from '@/lib/auth'
import type { Prisma, WorkOrderStatus } from '@prisma/client'
import { suggestSchedule, DEFAULT_HOURS_PER_DAY } from '@/lib/taller/scheduling'
import { getMechanicBacklogHours } from '@/lib/taller/prisma-deps'
import { isLockError, withLockedRoots, type LockRoot } from '@/lib/locking'
import {
  WORK_ORDER_CORRECTION_TARGET,
  WORK_ORDER_FORWARD_TRANSITIONS,
  isTerminalWorkOrderStatus,
  type WorkOrderTransitionKind,
} from '@/lib/taller/transitions'
import {
  transitionWorkOrderTx,
  isWorkOrderTransitionError,
  WORK_ORDER_TRANSITION_ERROR_MESSAGES,
} from '@/lib/taller/transition-work-order'

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

function revalidateTaller(woId?: string) {
  revalidatePath('/taller')
  if (woId) revalidatePath(`/taller/${woId}`)
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createWorkOrderSchema = z.object({
  vehicleId: z.string().min(1),
  kind: z.enum(['REPARACION', 'MEJORA']).default('REPARACION'),
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
  estimatedHours: z.coerce.number().positive().optional().nullable(),
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

const checklistUpdateSchema = z.object({
  result: z.enum(['PENDIENTE', 'OK', 'NECESITA_REPARACION', 'NO_APLICA']),
  notes: z.string().max(2000).optional().nullable(),
  photos: z.array(z.string().url()).max(20).optional(),
})

const estimatedCostSchema = z.coerce.number().positive()

const correctionReasonSchema = z.string().trim().min(3, 'Explica brevemente el motivo').max(500)

type ResolvedWorkOrder = {
  vehicleId: string
  sellerLeadId: string
  status: WorkOrderStatus
}

async function resolveWorkOrder(woId: string): Promise<ResolvedWorkOrder | null> {
  const order = await db.workOrder.findUnique({
    where: { id: woId },
    select: {
      vehicleId: true,
      status: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })
  return order
    ? { vehicleId: order.vehicleId, sellerLeadId: order.vehicle.sellerLeadId, status: order.status }
    : null
}

function workOrderRoots(order: ResolvedWorkOrder): LockRoot[] {
  return [
    { type: 'vehicle', id: order.vehicleId },
    { type: 'sellerLead', id: order.sellerLeadId },
  ]
}

async function withOpenWorkOrder<T>(
  woId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<ActionResult<T>> {
  const resolved = await resolveWorkOrder(woId)
  if (!resolved) return { ok: false, error: 'Orden no encontrada' }

  try {
    const data = await withLockedRoots(workOrderRoots(resolved), async (tx) => {
      const current = await tx.workOrder.findUnique({
        where: { id: woId },
        select: { status: true },
      })
      if (!current) throw new Error('WORK_ORDER_NOT_FOUND')
      if (isTerminalWorkOrderStatus(current.status)) throw new Error('WORK_ORDER_CLOSED')
      return operation(tx)
    })
    return { ok: true, data }
  } catch (error) {
    if (error instanceof Error && error.message === 'WORK_ORDER_NOT_FOUND') {
      return { ok: false, error: 'Orden no encontrada' }
    }
    if (error instanceof Error && error.message === 'WORK_ORDER_CLOSED') {
      return { ok: false, error: 'No se puede modificar una orden cerrada.' }
    }
    if (isLockError(error)) return { ok: false, error: error.message }
    throw error
  }
}

async function runWorkOrderTransition(input: {
  woId: string
  expectedCurrentStatus?: WorkOrderStatus
  target: WorkOrderStatus
  kind: WorkOrderTransitionKind
  actorId: string
  reason?: string | null
}): Promise<ActionResult> {
  const resolved = await resolveWorkOrder(input.woId)
  if (!resolved) return { ok: false, error: 'Orden no encontrada' }

  try {
    const result = await withLockedRoots(workOrderRoots(resolved), (tx) =>
      transitionWorkOrderTx(tx, {
        workOrderId: input.woId,
        expectedCurrentStatus: input.expectedCurrentStatus ?? resolved.status,
        target: input.target,
        kind: input.kind,
        actorId: input.actorId,
        reason: input.reason,
      })
    )
    revalidateTaller(input.woId)
    revalidatePath(`/vendedores/${result.sellerLeadId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (error) {
    if (isWorkOrderTransitionError(error)) {
      return { ok: false, error: WORK_ORDER_TRANSITION_ERROR_MESSAGES[error.code] }
    }
    if (isLockError(error)) return { ok: false, error: error.message }
    throw error
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createWorkOrder(formData: unknown): Promise<ActionResult<{ id: string }>> {
  // PR-A2: crear una orden es una MUTACIÓN → requiere permiso de edición (era `requireCanViewTaller`,
  // una escalada de privilegios: un rol de solo lectura podía crear órdenes). El validador Zod sigue
  // restringido a REPARACION|MEJORA; INSPECCION_ENTRADA solo se crea desde la transacción de entrada.
  const actor = await requireCanEditTaller()

  const parsed = createWorkOrderSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const {
    vehicleId,
    kind,
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
      kind,
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
  newStatus: WorkOrderStatus,
  reason?: string
): Promise<ActionResult> {
  const actor = await requireCanEditTaller()
  const resolved = await resolveWorkOrder(woId)
  if (!resolved) return { ok: false, error: 'Orden no encontrada' }

  const kind: WorkOrderTransitionKind = WORK_ORDER_FORWARD_TRANSITIONS[resolved.status].includes(
    newStatus
  )
    ? 'forward'
    : WORK_ORDER_CORRECTION_TARGET[resolved.status] === newStatus
      ? 'correction'
      : 'forward'

  if (kind === 'correction') {
    const parsedReason = correctionReasonSchema.safeParse(reason)
    if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message }
    reason = parsedReason.data
  }

  return runWorkOrderTransition({
    woId,
    expectedCurrentStatus: resolved.status,
    target: newStatus,
    kind,
    actorId: actor.id,
    reason,
  })
}

export async function reopenWorkOrder(
  woId: string,
  target: WorkOrderStatus,
  reason: string
): Promise<ActionResult> {
  const actor = await requireAdmin()
  const parsedReason = correctionReasonSchema.safeParse(reason)
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message }
  return runWorkOrderTransition({
    woId,
    target,
    kind: 'reopen',
    actorId: actor.id,
    reason: parsedReason.data,
  })
}

export async function updateChecklistItem(
  checklistItemId: string,
  data: { result: string; notes?: string | null; photos?: string[] }
): Promise<ActionResult> {
  await requireCanEditTaller()

  const parsed = checklistUpdateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: 'Datos de checklist inválidos.' }

  const item = await db.workOrderChecklist.findUnique({
    where: { id: checklistItemId },
    select: { workOrderId: true },
  })
  if (!item) return { ok: false, error: 'Ítem no encontrado' }

  const result = await withOpenWorkOrder(item.workOrderId, (tx) =>
    tx.workOrderChecklist.update({
      where: { id: checklistItemId },
      data: {
        result: parsed.data.result,
        notes: parsed.data.notes ?? null,
        photos: parsed.data.photos ?? [],
      },
    })
  )
  if (!result.ok) return result
  revalidateTaller(item.workOrderId)
  return { ok: true }
}

export async function addTimeEntry(woId: string, formData: unknown): Promise<ActionResult> {
  const actor = await requireCanEditTaller()

  const parsed = timeEntrySchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { hours, hourlyRate, description, workDate } = parsed.data
  const result = await withOpenWorkOrder(woId, (tx) =>
    tx.workOrderTimeEntry.create({
      data: {
        workOrderId: woId,
        workerId: actor.id,
        hours,
        hourlyRate,
        description,
        workDate: new Date(workDate),
      },
    })
  )
  if (!result.ok) return result

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

  const result = await withOpenWorkOrder(entry.workOrderId, (tx) =>
    tx.workOrderTimeEntry.delete({ where: { id: entryId } })
  )
  if (!result.ok) return result
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
  const result = await withOpenWorkOrder(woId, (tx) =>
    tx.workOrderPart.create({
      data: {
        workOrderId: woId,
        name,
        quantity,
        unitCost,
        supplier: supplier ?? null,
        invoiceUrl: invoiceUrl ?? null,
      },
    })
  )
  if (!result.ok) return result

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

  const result = await withOpenWorkOrder(part.workOrderId, (tx) =>
    tx.workOrderPart.delete({ where: { id: partId } })
  )
  if (!result.ok) return result
  revalidateTaller(part.workOrderId)
  return { ok: true }
}

export async function approveWorkOrder(woId: string): Promise<ActionResult> {
  const actor = await requireAdmin()

  const result = await withOpenWorkOrder(woId, async (tx) => {
    const order = await tx.workOrder.findUnique({
      where: { id: woId },
      select: { vehicle: { select: { sellerLeadId: true } } },
    })
    if (!order) throw new Error('WORK_ORDER_NOT_FOUND')
    await tx.workOrder.update({
      where: { id: woId },
      data: { approvalLevel: 'APROBADA_CEO', approvedById: actor.id, approvedAt: new Date() },
    })
    await tx.activity.create({
      data: {
        type: 'ORDEN_TALLER_APROBADA',
        content: 'Orden de taller aprobada por CEO.',
        agentId: actor.id,
        sellerLeadId: order.vehicle.sellerLeadId,
      },
    })
    return order.vehicle.sellerLeadId
  })
  if (!result.ok) return result

  revalidateTaller(woId)
  revalidatePath(`/vendedores/${result.data}`)
  return { ok: true }
}

export async function rejectWorkOrder(woId: string, reason?: string): Promise<ActionResult> {
  const actor = await requireAdmin()

  const result = await withOpenWorkOrder(woId, async (tx) => {
    const order = await tx.workOrder.findUnique({
      where: { id: woId },
      select: { vehicle: { select: { sellerLeadId: true } } },
    })
    if (!order) throw new Error('WORK_ORDER_NOT_FOUND')
    await tx.workOrder.update({
      where: { id: woId },
      data: { approvalLevel: 'RECHAZADA_CEO', approvedById: actor.id, approvedAt: new Date() },
    })
    await tx.activity.create({
      data: {
        type: 'ORDEN_TALLER_RECHAZADA',
        content: `Orden de taller rechazada por CEO.${reason ? ` Motivo: ${reason}` : ''}`,
        agentId: actor.id,
        sellerLeadId: order.vehicle.sellerLeadId,
      },
    })
    return order.vehicle.sellerLeadId
  })
  if (!result.ok) return result

  revalidateTaller(woId)
  revalidatePath(`/vendedores/${result.data}`)
  return { ok: true }
}

export async function updateEstimatedCost(
  woId: string,
  estimatedCost: number
): Promise<ActionResult> {
  await requireCanEditTaller()
  const parsedCost = estimatedCostSchema.safeParse(estimatedCost)
  if (!parsedCost.success) return { ok: false, error: 'Coste estimado inválido.' }
  estimatedCost = parsedCost.data

  const result = await withOpenWorkOrder(woId, async (tx) => {
    const order = await tx.workOrder.findUnique({
      where: { id: woId },
      select: { approvalLimit: true },
    })
    if (!order) throw new Error('WORK_ORDER_NOT_FOUND')
    const approvalLevel =
      estimatedCost > Number(order.approvalLimit) ? 'REQUIERE_CEO' : 'NO_REQUIERE'
    await tx.workOrder.update({
      where: { id: woId },
      data: { estimatedCost, approvalLevel },
    })
  })
  if (!result.ok) return result

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

  const { assignedToId, scheduledStart, scheduledEnd, estimatedHours } = parsed.data

  const start = new Date(scheduledStart)
  const end = new Date(scheduledEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'Fechas inválidas.' }
  }
  if (end < start) {
    return { ok: false, error: 'La fecha de fin no puede ser anterior al inicio.' }
  }

  const result = await withOpenWorkOrder(woId, async (tx) => {
    const order = await tx.workOrder.findUnique({
      where: { id: woId },
      select: { vehicle: { select: { sellerLeadId: true } } },
    })
    if (!order) throw new Error('WORK_ORDER_NOT_FOUND')
    await tx.workOrder.update({
      where: { id: woId },
      data: {
        assignedToId,
        scheduledStart: start,
        scheduledEnd: end,
        ...(estimatedHours != null ? { estimatedHours } : {}),
      },
    })
    return order.vehicle.sellerLeadId
  })
  if (!result.ok) return result

  revalidateTaller(woId)
  revalidatePath('/taller/agenda')
  if (result.data) revalidatePath(`/vendedores/${result.data}`)
  return { ok: true }
}
