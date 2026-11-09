'use client'

import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUpRight, PanelRightOpen, X } from 'lucide-react'
import Link from 'next/link'

export function BuyerPreview({
  name,
  href,
  children,
}: {
  name: string
  href: string
  children: ReactNode
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Vista rápida de ${name}`}
          title="Vista rápida"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink2 hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelRightOpen size={16} aria-hidden="true" />
          <span className="lg:sr-only">Vista rápida</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content
          className="crm-theme fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-card font-hanken text-ink shadow-xl focus:outline-none"
          aria-describedby={undefined}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line p-5">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold text-ink2">Vista rápida</p>
              <Dialog.Title className="break-words text-2xl font-bold tracking-tight">
                {name}
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Cerrar vista rápida"
              className="rounded-md p-2 text-ink2 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={18} />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          <footer className="border-t border-line p-5">
            <Link
              href={href}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir ficha completa <ArrowUpRight size={16} />
            </Link>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
