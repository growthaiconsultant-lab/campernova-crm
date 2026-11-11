'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bell } from 'lucide-react'
import { NewLeadButton } from './new-lead-button'
import { GlobalSearch } from './global-search'

interface TopbarProps {
  userName: string
  userEmail: string
  userRole: string
  /** Slot izquierdo — botón de menú móvil (hamburguesa). */
  leading?: React.ReactNode
}

/**
 * Header del shell (mockup: 60px, fondo --card, borde inferior --line).
 * Desktop: buscador global (⌘K) + "Nuevo lead" (--brand) + campana.
 * Móvil: hamburguesa (leading) + acciones compactas.
 * El buscador ⌘K está cableado (overlay global); la campana sigue visual.
 */
export function Topbar({ leading }: TopbarProps) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const searchParams = useSearchParams()
  const [buyersHref, setBuyersHref] = useState('/compradores')
  const [sellersHref, setSellersHref] = useState('/vendedores')
  const sellerList = pathname === '/vendedores'
  const sellerSection = sellerList || pathname.startsWith('/vendedores/')
  const buyerDetail = Boolean(params.id && pathname === `/compradores/${params.id}`)
  useEffect(() => {
    const query = searchParams.toString()
    const href = query ? pathname + '?' + query : pathname
    if (pathname === '/compradores') setBuyersHref(href)
    if (pathname === '/vendedores') setSellersHref(href)
  }, [pathname, searchParams])

  if (buyerDetail || sellerSection) {
    return (
      <header className="flex min-h-12 shrink-0 items-center gap-1 bg-[#173a2f] px-3 py-1 sm:gap-3 sm:px-6">
        <div className="lg:hidden [&>button:hover]:bg-white/10 [&>button]:text-white">
          {leading}
        </div>
        {sellerList ? (
          <span className="px-1.5 text-sm font-semibold text-white">Vendedores</span>
        ) : (
          <Link
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold text-white hover:bg-white/10"
            href={sellerSection ? sellersHref : buyersHref}
          >
            <ArrowLeft size={16} aria-hidden="true" />{' '}
            {sellerSection ? 'Vendedores' : 'Compradores'}
          </Link>
        )}
        <div className="flex-1" />
        <GlobalSearch compact />
        <NewLeadButton compact />
      </header>
    )
  }
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3.5 border-b border-line bg-card px-4 lg:px-[22px]">
      {/* Hamburguesa — solo móvil */}
      {leading}

      {/* Buscador global — abre overlay (⌘K) con resultados por entidad */}
      <GlobalSearch />

      {/* Nuevo lead — acción primaria (modal centrado: comprador/vendedor/captación) */}
      <NewLeadButton />

      {/* Campana */}
      <button
        type="button"
        aria-label="Notificaciones"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-card text-ink2 transition-colors hover:bg-canvas"
      >
        <Bell size={16} strokeWidth={2} />
        <span
          className="absolute right-[9px] top-[9px] h-[6px] w-[6px] rounded-full bg-bad"
          aria-hidden
        />
      </button>
    </header>
  )
}
