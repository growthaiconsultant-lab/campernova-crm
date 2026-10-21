import type { Prisma } from '@prisma/client'
import type { CreateCalendarEventInput } from '@/lib/validators/calendar-event'

export const FOLLOWUP_PAGE_SIZE = 10

// Legacy NOTA also contains system-generated entries. Keep their audit trail in Activity.
export function buyerCommercialNotesWhere(buyerLeadId: string): Prisma.ActivityWhereInput {
  return {
    buyerLeadId,
    type: 'NOTA',
    agentId: { not: null },
    NOT: [
      { content: { startsWith: 'Origen cambiado:' } },
      { content: { startsWith: 'COM-9: asignación automática inicial' } },
    ],
  }
}

export const BUYER_ACTION_OPTIONS = [
  { value: 'LLAMAR', label: 'Llamar', eventType: 'LLAMADA' },
  { value: 'WHATSAPP', label: 'Enviar WhatsApp', eventType: 'OTRO' },
  { value: 'EMAIL', label: 'Enviar email', eventType: 'OTRO' },
  { value: 'ENVIAR_VEHICULOS', label: 'Enviar vehículos', eventType: 'OTRO' },
  { value: 'PEDIR_DOCS', label: 'Pedir documentación', eventType: 'OTRO' },
  { value: 'VISITA', label: 'Visita con el comprador', eventType: 'CITA' },
  { value: 'SEGUIMIENTO', label: 'Hacer seguimiento', eventType: 'OTRO' },
  { value: 'OTRO', label: 'Otra acción', eventType: 'OTRO' },
] as const

export function buyerActionInput(input: {
  buyerLeadId: string
  actorId: string
  action: string
  title: string
  date: string
  time: string
  notes: string
  commitment: '' | 'EXTERNO' | 'INTERNO'
}): CreateCalendarEventInput {
  const action = BUYER_ACTION_OPTIONS.find((option) => option.value === input.action)
  if (!action) throw new Error('Selecciona un tipo de acción')
  const start = new Date(`${input.date}T${input.time}`)
  if (!input.date || !input.time || Number.isNaN(start.getTime()))
    throw new Error('Selecciona el día y la hora')
  if (input.action === 'OTRO' && !input.title.trim())
    throw new Error('Indica qué acción hay que hacer')
  return {
    type: action.eventType,
    title: input.title.trim() ? `${action.label} · ${input.title.trim()}` : action.label,
    description: input.notes.trim() || null,
    startAt: start.toISOString(),
    buyerLeadId: input.buyerLeadId,
    assignedToId: input.actorId,
    priority: 'MEDIA',
    commitment: action.eventType === 'CITA' ? 'EXTERNO' : input.commitment || null,
    specificData: { buyer_action_type: action.value },
  }
}

export function followupPage(value?: string): number {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1
}
