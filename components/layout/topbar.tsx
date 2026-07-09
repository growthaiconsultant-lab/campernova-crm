'use client'

import Link from 'next/link'
import { Search, Plus, Bell } from 'lucide-react'

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
 * El buscador ⌘K y la campana son visuales en Fase 1; se cablean en Fase 3.
 */
export function Topbar({ leading }: TopbarProps) {
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3.5 border-b border-line bg-card px-4 lg:px-[22px]">
      {/* Hamburguesa — solo móvil */}
      {leading}

      {/* Buscador global — desktop */}
      <button
        type="button"
        className="hover:border-ink3/40 hidden max-w-[420px] flex-1 items-center gap-[9px] rounded-[10px] border border-line bg-canvas px-[13px] py-[9px] text-left transition-colors lg:flex"
      >
        <Search size={16} strokeWidth={2} className="shrink-0 text-ink3" />
        <span className="flex-1 truncate font-hanken text-[13px] text-ink3">Buscar…</span>
        <kbd className="rounded-[5px] border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink3">
          ⌘K
        </kbd>
      </button>

      {/* Nuevo lead — acción primaria */}
      <Link
        href="/compradores/nuevo"
        className="ml-auto inline-flex items-center gap-[7px] rounded-[10px] bg-brand px-[15px] py-[10px] font-hanken text-[13px] font-semibold text-white transition-colors hover:bg-brand2"
      >
        <Plus size={15} strokeWidth={2.2} className="shrink-0" />
        <span className="hidden sm:inline">Nuevo lead</span>
      </Link>

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
