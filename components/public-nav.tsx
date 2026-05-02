'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#calculadora', label: 'Tasación gratis' },
  { href: '/#preguntas', label: 'FAQ' },
  { href: '/contacto', label: 'Contacto' },
]

export function PublicNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Skip-to-content for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-[#cc6119] focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Saltar al contenido
      </a>

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#153e4d] bg-[#294e4c]/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/images/brand/Logo Campers Nova.png"
              alt="CampersNova"
              width={140}
              height={36}
              className="h-8 w-auto object-contain brightness-0 invert"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Navegación principal">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-white/75 transition-colors hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Link href="/vender">
              <Button className="bg-[#cc6119] font-medium text-white hover:bg-[#cc6119]/90">
                Vender mi camper
              </Button>
            </Link>
          </div>

          {/* Mobile: CTA + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/vender">
              <Button
                size="sm"
                className="bg-[#cc6119] px-3 text-xs font-medium text-white hover:bg-[#cc6119]/90"
              >
                Vender
              </Button>
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
              className="rounded-md p-1.5 text-white/80 transition-colors hover:text-white"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {open && (
          <div className="border-t border-[#153e4d] bg-[#294e4c] md:hidden">
            <nav
              className="container mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4"
              aria-label="Menú móvil"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/10 py-2.5 text-sm text-white/80 transition-colors last:border-0 hover:text-white"
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
