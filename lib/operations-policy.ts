import type { UserRole } from '@prisma/client'

export const OPERATIONAL_DOCUMENT_ROLES: UserRole[] = ['ADMIN', 'AGENTE', 'TALLER']
export const OPERATIONAL_DELIVERY_ROLES: UserRole[] = ['ADMIN', 'ENTREGAS', 'TALLER']
export function canUseOperationalDocuments(user: { role: UserRole; active: boolean }) {
  return user.active && OPERATIONAL_DOCUMENT_ROLES.includes(user.role)
}
export function canManageOperationalDeliveries(user: { role: UserRole; active: boolean }) {
  return user.active && OPERATIONAL_DELIVERY_ROLES.includes(user.role)
}
export const OPERATIONAL_DOCUMENT_CATEGORIES = ['PRESUPUESTO', 'OPERATIVO'] as const
