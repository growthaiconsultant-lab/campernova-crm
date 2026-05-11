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
    <aside className="flex h-screen w-16 flex-col items-center bg-sidebar text-sidebar-foreground">
      {/* Logo + CRM badge */}
      <div className="flex h-16 w-full shrink-0 flex-col items-center justify-center gap-1.5 border-b border-sidebar-border">
        <LogoCampersNova variant="cream" novaSize={16} />
        <span
          className="rounded border px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50"
          style={{ borderColor: 'rgba(239,233,216,0.18)' }}
        >
          CRM
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          )
        })}

        {userRole === 'ADMIN' && (
          <Link
            href="/usuarios"
            title="Usuarios"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              pathname === '/usuarios' || pathname.startsWith('/usuarios/')
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <UserCog className="h-[18px] w-[18px]" />
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 pb-3">
        <p className="text-[8px] text-sidebar-foreground/25">v0.1</p>
      </div>
    </aside>
  )
}
