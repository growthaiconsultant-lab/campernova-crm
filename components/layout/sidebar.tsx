'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoCampersNova } from '@/components/logo-campers-nova'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Truck,
  UserCog,
  Wrench,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING'],
  },
  {
    href: '/vendedores',
    label: 'Vendedores',
    icon: Users,
    roles: ['ADMIN', 'AGENTE'],
  },
  {
    href: '/compradores',
    label: 'Compradores',
    icon: ShoppingCart,
    roles: ['ADMIN', 'AGENTE'],
  },
  {
    href: '/vehiculos',
    label: 'Vehículos',
    icon: Truck,
    roles: ['ADMIN', 'AGENTE', 'TALLER', 'MARKETING'],
  },
  {
    href: '/taller',
    label: 'Taller',
    icon: Wrench,
    roles: ['ADMIN', 'AGENTE', 'TALLER'],
  },
  {
    href: '/entregas',
    label: 'Entregas',
    icon: CalendarCheck,
    roles: ['ADMIN', 'AGENTE', 'ENTREGAS'],
  },
  {
    href: '/postventa',
    label: 'Postventa',
    icon: ShieldCheck,
    roles: ['ADMIN', 'AGENTE', 'ENTREGAS'],
  },
]

interface SidebarProps {
  userRole: UserRole
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole))

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <div className="flex items-center gap-3">
          <LogoCampersNova variant="cream" novaSize={20} />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            CRM
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
        {userRole === 'ADMIN' && (
          <Link
            href="/usuarios"
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/usuarios' || pathname.startsWith('/usuarios/')
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <UserCog className="h-4 w-4 shrink-0" />
            Usuarios
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border px-5 py-3">
        <p className="text-[10px] text-sidebar-foreground/40">v0.1 · MVP</p>
      </div>
    </aside>
  )
}
