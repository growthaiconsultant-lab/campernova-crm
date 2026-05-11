'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoCampersNova } from '@/components/logo-campers-nova'
import { LayoutDashboard, Users, ShoppingCart, Truck, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendedores', label: 'Vendedores', icon: Users },
  { href: '/compradores', label: 'Compradores', icon: ShoppingCart },
  { href: '/vehiculos', label: 'Vehículos', icon: Truck },
]

interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname()

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
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
        {isAdmin && (
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
