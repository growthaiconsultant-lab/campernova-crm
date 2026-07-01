'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const NAV_LINKS: { href: string; label: string; activePath?: string }[] = [
  { href: '/', label: 'Inicio' },
  { href: '/comprar', label: 'Comprar' },
  { href: '/vender', label: 'Vender' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/sobre', label: 'Sobre nosotros' },
]

export function PublicNav() {
  const pathname = usePathname()

  const isActive = (href: string, activePath?: string) => {
    const path = activePath ?? href.split('#')[0]
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(245,240,230,0.86)',
        backdropFilter: 'saturate(140%) blur(12px)',
        WebkitBackdropFilter: 'saturate(140%) blur(12px)',
        borderColor: 'rgba(88,71,56,0.10)',
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-8 max-[640px]:px-5">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo-cn-cropped.png"
            alt="CampersNova"
            width={756}
            height={334}
            className="h-9 w-auto lg:h-11"
            priority
          />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
          {NAV_LINKS.map(({ href, label, activePath }) => {
            const active = isActive(href, activePath)
            return (
              <Link
                key={label}
                href={href}
                className="relative py-1.5 text-[14px] font-medium transition-colors hover:text-cn-teal-900"
                style={{ color: active ? 'var(--cn-teal-900)' : 'var(--cn-ink-700)' }}
              >
                {label}
                {active && (
                  <span
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--cn-terra-500)' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* CTAs — always visible, scale down on mobile */}
        <div className="flex shrink-0 items-center gap-2 lg:gap-2.5">
          <Link
            href="/comprar"
            className="inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all lg:px-4 lg:py-2.5 lg:text-[13px]"
            style={{ borderColor: 'var(--cn-teal-900)', color: 'var(--cn-teal-900)' }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--cn-teal-900)'
              el.style.color = 'var(--cn-cream-50)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = ''
              el.style.color = 'var(--cn-teal-900)'
            }}
          >
            Comprar
          </Link>
          <Link
            href="/vender"
            className="inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[12px] font-medium text-white transition-all hover:opacity-90 lg:px-4 lg:py-2.5 lg:text-[13px]"
            style={{ background: 'var(--cn-terra-500)' }}
          >
            Vender mi vehículo
          </Link>
        </div>
      </div>
    </header>
  )
}
