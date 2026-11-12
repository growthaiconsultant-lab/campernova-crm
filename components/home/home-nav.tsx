'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, Menu } from 'lucide-react'

const links = [
  ['comprar', 'Comprar'],
  ['vender', 'Vender'],
  ['taller', 'Taller'],
  ['garantias', 'Garantías'],
  ['tienda', 'Tienda'],
] as const

export function HomeNav() {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const items = links.map(([id, label]) => (
    <a key={id} href={'#' + id} onClick={() => setOpen(false)}>
      {label}
    </a>
  ))
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
      <a href="#main-content" aria-label="Ir al contenido">
        <Image
          priority
          className="logo"
          src="/logo-cn-cropped.png"
          alt="CampersNova"
          width={108}
          height={48}
        />
      </a>
      <nav aria-label="Navegación principal">{items}</nav>
      <a className="contact" href="#visitanos">
        Contacto <ArrowUpRight />
      </a>
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
        <a href="#visitanos" onClick={() => setOpen(false)}>
          Contacto
        </a>
      </nav>
    </div>
  )
}
