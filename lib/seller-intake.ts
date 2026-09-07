import type { Prisma, SellerIntakeStatus } from '@prisma/client'

const TERMINAL_SELLER_STATUSES = ['CERRADO', 'DESCARTADO'] as const
const STOCK_VEHICLE_STATUSES = ['TASADO', 'PUBLICADO', 'RESERVADO'] as const

export const SELLER_INTAKE_LABELS: Record<SellerIntakeStatus, string> = {
  PENDIENTE: 'Solicitud web pendiente',
  ADMITIDO: 'Admitido en CRM',
  RECHAZADO: 'Solicitud web rechazada',
}

export const admittedSellerWhere = {
  intakeStatus: 'ADMITIDO',
} satisfies Prisma.SellerLeadWhereInput

export const admittedVehicleWhere = {
  sellerLead: admittedSellerWhere,
} satisfies Prisma.VehicleWhereInput

export function buildSellerIntakeViewConditions(
  view: string,
  currentUserId: string,
  twoDaysAgo: Date,
  startOfWeek: Date
): Prisma.SellerLeadWhereInput {
  if (view === 'leads-web') return { canal: 'PRO', intakeStatus: 'PENDIENTE' }
  if (view === 'web-rechazadas') return { canal: 'PRO', intakeStatus: 'RECHAZADO' }
  if (view === 'stock')
    return {
      AND: [admittedSellerWhere, { vehicle: { status: { in: [...STOCK_VEHICLE_STATUSES] } } }],
    }
  if (view === 'mis-leads')
    return {
      AND: [
        admittedSellerWhere,
        { agentId: currentUserId, status: { notIn: [...TERMINAL_SELLER_STATUSES] } },
      ],
    }
  if (view === 'sin-asignar')
    return {
      AND: [
        admittedSellerWhere,
        { agentId: null, status: { notIn: [...TERMINAL_SELLER_STATUSES] } },
      ],
    }
  if (view === 'sin-tasar')
    return {
      AND: [
        admittedSellerWhere,
        {
          status: { notIn: [...TERMINAL_SELLER_STATUSES] },
          OR: [{ vehicle: null }, { vehicle: { valuationRecommended: null } }],
        },
      ],
    }
  if (view === 'necesitan-accion')
    return {
      AND: [
        admittedSellerWhere,
        {
          status: { notIn: [...TERMINAL_SELLER_STATUSES] },
          activities: { none: { createdAt: { gte: twoDaysAgo } } },
        },
      ],
    }
  if (view === 'esta-semana')
    return { AND: [admittedSellerWhere, { createdAt: { gte: startOfWeek } }] }
  return admittedSellerWhere
}

export type SellerIntakeDecision = Extract<SellerIntakeStatus, 'ADMITIDO' | 'RECHAZADO'>

export function canDecideSellerIntake(
  current: SellerIntakeStatus,
  target: SellerIntakeDecision
): boolean {
  if (current === target) return true
  if (target === 'ADMITIDO') return current === 'PENDIENTE' || current === 'RECHAZADO'
  return current === 'PENDIENTE'
}

export function sellerIntakeActivityType(target: SellerIntakeDecision) {
  return target === 'ADMITIDO' ? 'SOLICITUD_WEB_ADMITIDA' : 'SOLICITUD_WEB_RECHAZADA'
}

export function sellerIntakeActivityContent(target: SellerIntakeDecision) {
  return target === 'ADMITIDO'
    ? 'Solicitud web admitida en el CRM.'
    : 'Solicitud web rechazada en admisión.'
}
