'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SidebarContent } from '@/components/layout/sidebar'
import type { UserRole } from '@prisma/client'

interface MobileSidebarProps {
  userRole: UserRole
  userName: string
  roleLabel: string
}

export function MobileSidebar({ userRole, userName, roleLabel }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Cierra el drawer al navegar (cambio de ruta)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Bloquea el scroll del body mientras el drawer está abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col shadow-xl">
            <SidebarContent
              userRole={userRole}
              userName={userName}
              roleLabel={roleLabel}
              onNavigate={() => setOpen(false)}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
