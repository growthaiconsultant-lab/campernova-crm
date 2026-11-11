'use client'

import {
  LayoutDashboard,
  ShoppingCart,
  UserRound,
  Package,
  Calendar,
  Wrench,
  Truck,
  ShieldCheck,
} from 'lucide-react'
import { MobileTabBar, type MobileTab } from '@/components/redesign'
import type { UserRole } from '@prisma/client'

/** Accesos móviles disponibles para cada rol del CRM. */
const TABS: (MobileTab & { roles: UserRole[] })[] = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING'],
  },
  { href: '/compradores', label: 'Compradores', icon: ShoppingCart, roles: ['ADMIN', 'AGENTE'] },
  { href: '/vendedores', label: 'Vendedores', icon: UserRound, roles: ['ADMIN', 'AGENTE'] },
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
  const tabs = TABS.filter((t) => t.roles.includes(userRole))
  if (tabs.length < 2) return null
  return <MobileTabBar tabs={tabs} />
}
