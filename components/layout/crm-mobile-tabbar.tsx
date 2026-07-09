'use client'

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calendar,
  Wrench,
  Truck,
  ShieldCheck,
} from 'lucide-react'
import { MobileTabBar, type MobileTab } from '@/components/redesign'
import type { UserRole } from '@prisma/client'

/**
 * Tab bar inferior móvil del rediseño (mockups M1/MC1/MV1…): Inicio ·
 * Compradores · Vehículos · Agenda. Se filtra por rol (mismas reglas que el
 * sidebar) y se completa con los módulos del rol si alguno no aplica.
 */
const TABS: (MobileTab & { roles: UserRole[] })[] = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING'],
  },
  { href: '/compradores', label: 'Compradores', icon: ShoppingCart, roles: ['ADMIN', 'AGENTE'] },
  {
    href: '/vehiculos',
    label: 'Vehículos',
    icon: Package,
    roles: ['ADMIN', 'AGENTE', 'TALLER', 'MARKETING'],
  },
  {
    href: '/calendario',
    label: 'Agenda',
    icon: Calendar,
    roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS'],
  },
  { href: '/taller', label: 'Taller', icon: Wrench, roles: ['TALLER'] },
  { href: '/entregas', label: 'Entregas', icon: Truck, roles: ['ENTREGAS'] },
  { href: '/postventa', label: 'Postventa', icon: ShieldCheck, roles: ['ENTREGAS'] },
]

export function CrmMobileTabBar({ userRole }: { userRole: UserRole }) {
  const tabs = TABS.filter((t) => t.roles.includes(userRole)).slice(0, 4)
  if (tabs.length < 2) return null
  return <MobileTabBar tabs={tabs} />
}
