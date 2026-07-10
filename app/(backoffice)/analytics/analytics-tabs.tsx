'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

/**
 * Conmutador de dashboards del producto Analytics (mockup CampersNova
 * Dashboards): tabs horizontales sobre el contenido; el activo va en
 * brand-tint. Se filtra por rol con las mismas reglas que el sidebar.
 */
const TABS: { href: string; label: string; roles: UserRole[] }[] = [
  { href: '/analytics/direccion', label: 'Dirección', roles: ['ADMIN', 'MARKETING'] },
  { href: '/analytics/crm', label: 'CRM', roles: ['ADMIN', 'AGENTE', 'MARKETING'] },
  { href: '/analytics/comercial', label: 'Comercial', roles: ['ADMIN', 'AGENTE', 'MARKETING'] },
  {
    href: '/analytics/operaciones',
    label: 'Operaciones',
    roles: ['ADMIN', 'AGENTE', 'ENTREGAS', 'TALLER', 'MARKETING'],
  },
  { href: '/analytics/matching', label: 'Matching', roles: ['ADMIN', 'AGENTE', 'MARKETING'] },
  { href: '/analytics/mercado', label: 'Mercado', roles: ['ADMIN', 'AGENTE', 'MARKETING'] },
  { href: '/analytics/calidad', label: 'Calidad', roles: ['ADMIN', 'MARKETING'] },
]

export function AnalyticsTabs({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabs = TABS.filter((t) => t.roles.includes(userRole))
  if (tabs.length === 0) return null

  // El rango global (?range=) se preserva al cambiar de dashboard.
  const range = searchParams.get('range')
  const withRange = (href: string) => (range ? `${href}?range=${range}` : href)

  return (
    <nav
      aria-label="Dashboards"
      className="mb-5 flex gap-1 overflow-x-auto rounded-[11px] border border-line bg-card p-1"
    >
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={withRange(t.href)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-[8px] px-3.5 py-2 font-hanken text-[12.5px] font-semibold transition-colors',
              active ? 'bg-brand-tint text-brand' : 'text-ink2 hover:bg-canvas hover:text-ink'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
