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
  CalendarDays,
  ShieldCheck,
  Radar,
  HandCoins,
  BarChart3,
  Building2,
  Boxes,
  Zap,
  TrendingUp,
  Target,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/app/(backoffice)/actions'
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
        href: '/captaciones',
        label: 'Captaciones',
        icon: Radar,
        roles: ['ADMIN', 'AGENTE'],
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
        href: '/ofertas',
        label: 'Ofertas',
        icon: HandCoins,
        roles: ['ADMIN', 'AGENTE'],
      },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      {
        href: '/calendario',
        label: 'Calendario',
        icon: CalendarDays,
        roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS'],
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
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        href: '/analytics/direccion',
        label: 'Dirección',
        icon: Building2,
        roles: ['ADMIN', 'MARKETING'],
      },
      {
        href: '/analytics/crm',
        label: 'CRM',
        icon: BarChart3,
        roles: ['ADMIN', 'AGENTE', 'MARKETING'],
      },
      {
        href: '/analytics/comercial',
        label: 'Comercial',
        icon: Target,
        roles: ['ADMIN', 'AGENTE', 'MARKETING'],
      },
      {
        href: '/analytics/operaciones',
        label: 'Operaciones',
        icon: Boxes,
        roles: ['ADMIN', 'AGENTE', 'ENTREGAS', 'TALLER', 'MARKETING'],
      },
      {
        href: '/analytics/matching',
        label: 'Matching',
        icon: Zap,
        roles: ['ADMIN', 'AGENTE', 'MARKETING'],
      },
      {
        href: '/analytics/mercado',
        label: 'Mercado',
        icon: TrendingUp,
        roles: ['ADMIN', 'AGENTE', 'MARKETING'],
      },
    ],
  },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
  roleLabel: string
  onNavigate?: () => void
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function SidebarContent({ userRole, userName, roleLabel, onNavigate }: SidebarProps) {
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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
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
                <Link key={href} href={href} className={navLinkClass(href)} onClick={onNavigate}>
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
            <Link href="/usuarios" className={navLinkClass('/usuarios')} onClick={onNavigate}>
              <UserCog className="h-[17px] w-[17px] shrink-0" />
              Usuarios
            </Link>
          </div>
        )}
      </nav>

      {/* Footer — usuario + logout */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
            {getInitials(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
              {userName}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({
  userRole,
  userName,
  roleLabel,
}: {
  userRole: UserRole
  userName: string
  roleLabel: string
}) {
  return (
    <aside className="hidden h-screen w-56 shrink-0 lg:flex">
      <SidebarContent userRole={userRole} userName={userName} roleLabel={roleLabel} />
    </aside>
  )
}
