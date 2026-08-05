import type { TicketStatus } from '@prisma/client'

export type TicketTransitionKind = 'forward' | 'correction' | 'reopen'

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  ANULADO: 'Anulado',
}

export const TICKET_FORWARD_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  ABIERTO: ['EN_PROGRESO', 'ANULADO'],
  EN_PROGRESO: ['RESUELTO', 'ANULADO'],
  RESUELTO: ['CERRADO'],
}

export const TICKET_CORRECTION_TARGET: Partial<Record<TicketStatus, TicketStatus>> = {
  EN_PROGRESO: 'ABIERTO',
  RESUELTO: 'EN_PROGRESO',
}

export const TICKET_REOPEN_TARGET: Partial<Record<TicketStatus, TicketStatus>> = {
  CERRADO: 'RESUELTO',
  ANULADO: 'ABIERTO',
}

export function isTicketTransitionAllowed(
  from: TicketStatus,
  to: TicketStatus,
  kind: TicketTransitionKind
): boolean {
  if (kind === 'forward') return TICKET_FORWARD_TRANSITIONS[from]?.includes(to) ?? false
  if (kind === 'correction') return TICKET_CORRECTION_TARGET[from] === to
  return TICKET_REOPEN_TARGET[from] === to
}

export function isTerminalTicketStatus(status: TicketStatus): boolean {
  return status === 'CERRADO' || status === 'ANULADO'
}
