'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ShoppingCart, UserRound, ScanSearch, X } from 'lucide-react'

/**
 * Botón "Nuevo lead" del header (ESPEC §5): abre un modal centrado sobre
 * scrim rgba(8,10,14,.45), card --card radio 14px, con las tres altas
 * posibles (comprador / vendedor / captación de portal).
 */
const OPTIONS = [
  {
    href: '/compradores/nuevo',
    icon: ShoppingCart,
    title: 'Comprador',
    desc: 'Alguien que busca camper o autocaravana',
  },
  {
    href: '/vendedores/nuevo',
    icon: UserRound,
    title: 'Vendedor',
    desc: 'Un propietario que quiere vender su vehículo',
  },
  {
    href: '/captaciones',
    icon: ScanSearch,
    title: 'Captación',
    desc: 'Un anuncio de portal que queremos perseguir',
  },
]

export function NewLeadButton() {
  const [open, setOpen] = useState(false)

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto inline-flex items-center gap-[7px] rounded-[10px] bg-brand px-[15px] py-[10px] font-hanken text-[13px] font-semibold text-white transition-colors hover:bg-brand2"
      >
        <Plus size={15} strokeWidth={2.2} className="shrink-0" />
        <span className="hidden sm:inline">Nuevo lead</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(8,10,14,0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo lead"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-[14px] border border-line bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-hanken text-[15px] font-bold text-ink">Nuevo lead</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-[9px] text-ink3 transition-colors hover:bg-canvas hover:text-ink"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {OPTIONS.map(({ href, icon: Icon, title, desc }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-[10px] border border-line p-3 transition-colors hover:border-brand hover:bg-brand-tint"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-brand-tint text-brand">
                    <Icon size={17} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-hanken text-[13.5px] font-semibold text-ink">
                      {title}
                    </span>
                    <span className="block truncate font-hanken text-[12px] text-ink2">{desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
