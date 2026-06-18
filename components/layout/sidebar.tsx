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

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Pipeline',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING'],
      },
      {
        href: '/vehiculos',
        label: 'Vehículos',
        icon: Truck,
        roles: ['ADMIN', 'AGENTE', 'TALLER', 'MARKETING'],
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
    ],
  },
  {
    title: 'Operaciones',
    items: [
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
    ],
  },
]

interface SidebarProps {
  userRole: UserRole
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const navLinkClass = (href: string) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
      isActive(href)
        ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
    )

  return (
    <aside className="flex h-screen w-56 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <LogoCampersNova variant="cream" className="[--logo-campers:9px] [--logo-nova:24px]" />
        <span
          className="rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.20em] text-sidebar-foreground/50"
          style={{ borderColor: 'rgba(239,233,216,0.22)' }}
        >
          CRM
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, i) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(userRole))
          if (visibleItems.length === 0) return null
          return (
            <div key={i} className="flex flex-col gap-0.5">
              {section.title && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/30">
                  {section.title}
                </p>
              )}
              {visibleItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={navLinkClass(href)}>
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          )
        })}

        {userRole === 'ADMIN' && (
          <div className="flex flex-col gap-0.5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/30">
              Sistema
            </p>
            <Link href="/usuarios" className={navLinkClass('/usuarios')}>
              <UserCog className="h-[17px] w-[17px] shrink-0" />
              Usuarios
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-4">
        <p className="text-[8px] text-sidebar-foreground/25">v0.1</p>
      </div>
    </aside>
  )
}
