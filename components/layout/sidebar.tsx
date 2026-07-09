'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ScanSearch,
  UserRound,
  ShoppingCart,
  Handshake,
  Calendar,
  Wrench,
  Truck,
  ShieldCheck,
  LineChart,
  BarChart3,
  Target,
  Boxes,
  Zap,
  TrendingUp,
  BadgeCheck,
  UserCog,
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
  title: string
  items: NavItem[]
}

// Iconos según el mapeo del ESPEC §3 (Lucide, trazo 1.9, currentColor).
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
        icon: Package,
        roles: ['ADMIN', 'AGENTE', 'TALLER', 'MARKETING'],
      },
      { href: '/captaciones', label: 'Captaciones', icon: ScanSearch, roles: ['ADMIN', 'AGENTE'] },
      { href: '/vendedores', label: 'Vendedores', icon: UserRound, roles: ['ADMIN', 'AGENTE'] },
      {
        href: '/compradores',
        label: 'Compradores',
        icon: ShoppingCart,
        roles: ['ADMIN', 'AGENTE'],
      },
      { href: '/ofertas', label: 'Ofertas', icon: Handshake, roles: ['ADMIN', 'AGENTE'] },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      {
        href: '/calendario',
        label: 'Calendario',
        icon: Calendar,
        roles: ['ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS'],
      },
      { href: '/taller', label: 'Taller', icon: Wrench, roles: ['ADMIN', 'AGENTE', 'TALLER'] },
      {
        href: '/entregas',
        label: 'Entregas',
        icon: Truck,
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
        icon: LineChart,
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
      {
        href: '/analytics/calidad',
        label: 'Calidad de datos',
        icon: BadgeCheck,
        roles: ['ADMIN', 'MARKETING'],
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

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(userRole)),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Logo (mockup: 60px, CN cuadrado verde + CampersNova + badge CRM) */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-panel-line px-[18px]">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand font-hanken text-[14px] font-extrabold leading-none tracking-[-0.03em] text-white"
          style={{ boxShadow: '0 2px 8px rgba(14,125,107,0.4)' }}
          aria-hidden
        >
          CN
        </span>
        <span className="font-hanken text-[15px] font-bold leading-none tracking-[-0.01em] text-white">
          CampersNova
        </span>
        <span className="rounded-[4px] border border-panel-line px-[5px] py-[3px] font-mono text-[8px] font-bold leading-none tracking-[0.2em] text-panel-ink2">
          CRM
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-3 py-3.5">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-[3px]">
            <span className="px-2.5 pb-1.5 pt-2 font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.14em] text-panel-ink2">
              {section.title}
            </span>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'relative flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] font-hanken text-[13.5px] transition-colors',
                    active
                      ? 'bg-brand-tint font-semibold text-white'
                      : 'font-medium text-panel-ink hover:bg-panel2 hover:text-white'
                  )}
                >
                  {active && (
                    <span
                      className="absolute bottom-[7px] left-[-12px] top-[7px] w-[3px] rounded-r-[3px] bg-brand"
                      aria-hidden
                    />
                  )}
                  <Icon size={17} strokeWidth={1.9} className="shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}

        {userRole === 'ADMIN' && (
          <div className="flex flex-col gap-[3px]">
            <span className="px-2.5 pb-1.5 pt-3.5 font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.14em] text-panel-ink2">
              Sistema
            </span>
            <Link
              href="/usuarios"
              onClick={onNavigate}
              className={cn(
                'relative flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] font-hanken text-[13.5px] transition-colors',
                isActive('/usuarios')
                  ? 'bg-brand-tint font-semibold text-white'
                  : 'font-medium text-panel-ink hover:bg-panel2 hover:text-white'
              )}
            >
              {isActive('/usuarios') && (
                <span
                  className="absolute bottom-[7px] left-[-12px] top-[7px] w-[3px] rounded-r-[3px] bg-brand"
                  aria-hidden
                />
              )}
              <UserCog size={17} strokeWidth={1.9} className="shrink-0" />
              Usuarios
            </Link>
          </div>
        )}
      </nav>

      {/* Footer — avatar + nombre + rol + logout */}
      <div className="flex shrink-0 items-center gap-2.5 border-t border-panel-line p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2c3340] font-hanken text-[12px] font-semibold text-white">
          {getInitials(userName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-hanken text-[12.5px] font-semibold leading-tight text-[#e7eaef]">
            {userName}
          </span>
          <span className="block font-hanken text-[10.5px] font-medium text-panel-ink2">
            {roleLabel}
          </span>
        </span>
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-panel-ink2 transition-colors hover:bg-panel2 hover:text-white"
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
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
    <aside className="hidden h-screen w-[246px] shrink-0 border-r border-panel-line lg:flex">
      <SidebarContent userRole={userRole} userName={userName} roleLabel={roleLabel} />
    </aside>
  )
}
