'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Chrome móvil del rediseño (ESPEC §4). En producción el móvil es responsive
 * (sin marco de dispositivo); estas piezas son la barra de pestañas inferior y
 * la barra de acción fija de las fichas. `PhoneFrame` (marco 390×844) se usa
 * solo en contextos de preview/QA de diseño.
 */

export interface MobileTab {
  href: string
  label: string
  icon: React.ElementType
}

export function MobileTabBar({ tabs }: { tabs: MobileTab[] }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card px-2 pb-[22px] pt-2 lg:hidden">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1',
              active ? 'text-brand' : 'text-ink3'
            )}
          >
            <Icon size={21} strokeWidth={active ? 2.1 : 1.9} />
            <span className="font-hanken text-[9.5px] font-semibold">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Barra de acción fija inferior de fichas móviles (Llamar / WhatsApp…). */
export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-card px-4 pb-[22px] pt-3 lg:hidden">
      {children}
    </div>
  )
}

/** Cabecera móvil de ficha: back + título + pill de estado. */
export function MobileDetailHeader({
  backHref,
  title,
  status,
}: {
  backHref: string
  title: React.ReactNode
  status?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-card px-4 lg:hidden">
      <Link href={backHref} aria-label="Volver" className="-ml-1 text-ink2">
        {/* ChevronLeft inline para no forzar import extra en el consumidor */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
      <span className="min-w-0 flex-1 truncate font-hanken text-[15px] font-bold text-ink">
        {title}
      </span>
      {status}
    </header>
  )
}

/**
 * Marco de dispositivo (390×844, radio 44, barra de estado 9:41). Solo para
 * previews de diseño; las páginas reales usan el layout responsive.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex h-[844px] w-[390px] shrink-0 flex-col overflow-hidden rounded-[44px] border border-line bg-canvas"
      style={{ boxShadow: '0 30px 80px rgba(20,25,34,0.26)' }}
    >
      <div className="flex h-11 shrink-0 items-center justify-between px-7 pt-2 font-hanken text-[13px] font-semibold text-ink">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <svg width="22" height="12" viewBox="0 0 24 13" fill="none" aria-hidden>
            <rect
              x="0.5"
              y="0.5"
              width="20"
              height="11"
              rx="3"
              stroke="currentColor"
              opacity="0.5"
            />
            <rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" />
            <rect
              x="21.5"
              y="4"
              width="1.5"
              height="4"
              rx="0.75"
              fill="currentColor"
              opacity="0.5"
            />
          </svg>
        </span>
      </div>
      <div className="flex-1 overflow-hidden rounded-t-[34px]">{children}</div>
    </div>
  )
}
