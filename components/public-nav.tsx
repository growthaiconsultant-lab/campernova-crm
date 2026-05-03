'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  // /comprar points to home anchor until the page is built in commit 7
  { href: '/#search-method', label: 'Comprar', activePath: '/comprar' },
  { href: '/vender', label: 'Vender' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/sobre', label: 'Sobre nosotros' },
]

export function PublicNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string, activePath?: string) => {
    const path = activePath ?? href.split('#')[0]
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-cn-terra-500 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Saltar al contenido
      </a>

      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: 'rgba(245,240,230,0.86)',
          backdropFilter: 'saturate(140%) blur(12px)',
          WebkitBackdropFilter: 'saturate(140%) blur(12px)',
          borderColor: 'rgba(38,77,73,0.08)',
        }}
      >
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between gap-5 px-8 max-[640px]:px-5">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/images/brand/Logo Campers Nova.png"
              alt="CampersNova"
              width={148}
              height={38}
              className="h-[38px] w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
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

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <Link
              href="/#search-method"
              className="inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all"
              style={{
                borderColor: 'var(--cn-teal-900)',
                color: 'var(--cn-teal-900)',
              }}
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
              className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--cn-terra-500)' }}
            >
              Vender mi vehículo
            </Link>
          </div>

          {/* Mobile: CTA + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/vender"
              className="inline-flex items-center rounded-full px-3 py-2 text-xs font-medium text-white"
              style={{ background: 'var(--cn-terra-500)' }}
            >
              Vender
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
              className="rounded-md p-1.5 transition-colors"
              style={{ color: 'var(--cn-ink-700)' }}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div
            className="border-t lg:hidden"
            style={{
              borderColor: 'rgba(38,77,73,0.08)',
              background: 'rgba(245,240,230,0.97)',
            }}
          >
            <nav
              className="mx-auto flex max-w-[1280px] flex-col px-8 py-4 max-[640px]:px-5"
              aria-label="Menú móvil"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="border-b py-3 text-sm font-medium transition-colors last:border-0 hover:text-cn-teal-900"
                  style={{
                    borderColor: 'rgba(38,77,73,0.08)',
                    color: 'var(--cn-ink-700)',
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  )
}
