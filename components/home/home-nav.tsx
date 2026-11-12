'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { homeFormPaths, publicNavigation } from '@/lib/public-navigation'
import { ArrowUpRight, Menu } from 'lucide-react'

export function HomeNav({
  currentPath = '/',
  navigation = publicNavigation,
}: {
  currentPath?: string
  navigation?: typeof publicNavigation
} = {}) {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const items = navigation.map(({ href, label }) => {
    if (href === '/comprar' || href === '/vender') {
      return (
        <a key={href} href={homeFormPaths[href]} onClick={() => setOpen(false)}>
          {label}
        </a>
      )
    }
    return (
      <Link
        key={href}
        href={href}
        aria-current={href === currentPath ? 'page' : undefined}
        onClick={() => setOpen(false)}
      >
        {label}
      </Link>
    )
  })
  return (
    <div
      className="shell nav"
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          setOpen(false)
          toggle.current?.focus()
        }
      }}
    >
      <Link href="/" aria-label="CampersNova, inicio">
        <Image
          priority
          className="logo"
          src="/logo-cn-cropped.png"
          alt="CampersNova"
          width={108}
          height={48}
        />
      </Link>
      <nav aria-label="Navegación principal">{items}</nav>
      <Link className="contact" href="/contacto">
        Contacto <ArrowUpRight />
      </Link>
      <button
        ref={toggle}
        type="button"
        className="mobileMenu"
        aria-controls="home-menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Menú <Menu />
      </button>
      <nav id="home-menu" className={'dropdown' + (open ? ' open' : '')} aria-label="Menú móvil">
        {items}
        <Link href="/contacto" onClick={() => setOpen(false)}>
          Contacto
        </Link>
      </nav>
    </div>
  )
}
