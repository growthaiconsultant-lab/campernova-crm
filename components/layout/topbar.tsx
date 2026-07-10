'use client'

import { Bell } from 'lucide-react'
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
