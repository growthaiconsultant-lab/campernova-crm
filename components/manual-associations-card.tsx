'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Link2,
  Loader2,
  Search,
  Truck,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createManualMatch, searchManualMatches } from '@/app/(backoffice)/matches/manual-actions'
import type { AssociationCandidate } from '@/lib/manual-matches'

export type ManualAssociationSummary = { id: string; label: string; detail: string; href: string }

export function ManualAssociationsCard({
  side,
  fixedId,
  entries,
  listHref,
  disabledReason,
}: {
  side: 'buyer' | 'vehicle'
  fixedId: string
  entries: ManualAssociationSummary[]
  listHref: string
  disabledReason?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<AssociationCandidate[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [selected, setSelected] = useState<AssociationCandidate | null>(null)
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [retry, setRetry] = useState(0)
  const [message, setMessage] = useState('')
  const isBuyer = side === 'buyer'
  const action = isBuyer ? 'Asociar vehículo' : 'Asociar comprador'
  const title = isBuyer ? 'Vehículos de interés' : 'Compradores interesados'
  const Icon = isBuyer ? Truck : UserRound

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSearchError('')
    const timer = setTimeout(async () => {
      try {
        const result = await searchManualMatches({ side, fixedId, query, page })
        if (cancelled) return
        if (!result.ok) {
          setSearchError(result.error)
          setItems([])
          setHasMore(false)
        } else {
          setItems(result.items)
          setHasMore(result.hasMore)
        }
      } catch {
        if (!cancelled) {
          setSearchError('No se pudo buscar. Inténtalo de nuevo.')
          setItems([])
          setHasMore(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, side, fixedId, query, page, retry])

  function changeOpen(value: boolean) {
    if (pending) return
    setOpen(value)
    setQuery('')
    setPage(0)
    setItems([])
    setSelected(null)
    setError('')
    setSearchError('')
    if (value) {
      setLoading(true)
      setMessage('')
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || pending) return
    setPending(true)
    setError('')
    try {
      const result = await createManualMatch(
        isBuyer
          ? { buyerLeadId: fixedId, vehicleId: selected.id }
          : { vehicleId: fixedId, buyerLeadId: selected.id }
      )
      if (!result.ok) setError(result.error)
      else {
        setMessage(
          result.saved
            ? 'Interés guardado. Ya está asociado en ambas fichas.'
            : 'Este interés ya estaba asociado en ambas fichas.'
        )
        setOpen(false)
        router.refresh()
      }
    } catch {
      setError(
        'No se pudo confirmar el guardado. Reintenta con la misma selección; no se duplicará.'
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        {entries.length > 0 && (
          <span className="rounded-full bg-sidebar-primary/10 px-2 py-0.5 text-[11px] font-semibold text-sidebar-primary">
            {entries.length}
          </span>
        )}
      </div>
      {entries.length ? (
        <ul className="mb-4 space-y-3">
          {entries.slice(0, 3).map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.href}
                className="block truncate text-[13px] font-semibold text-foreground hover:text-sidebar-primary hover:underline"
                title={entry.label}
              >
                {entry.label}
              </Link>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
          {isBuyer
            ? 'Asocia las furgos que este cliente quiere comprar.'
            : 'Asocia los clientes interesados en este vehículo.'}
        </p>
      )}
      {disabledReason ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">{disabledReason}</p>
      ) : (
        <Button
          onClick={() => changeOpen(true)}
          className="w-full gap-2 bg-sidebar-primary text-white hover:bg-sidebar-primary/90"
          size="sm"
        >
          <Link2 className="h-3.5 w-3.5" />
          {action}
        </Button>
      )}
      {entries.length > 0 && (
        <Link
          href={listHref}
          className="mt-3 block text-[12px] font-medium text-sidebar-primary hover:underline"
        >
          Ver intereses y sugerencias →
        </Link>
      )}
      <p role="status" className="mt-2 text-[12px] text-sidebar-primary">
        {message}
      </p>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="crm-theme max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>{action}</DialogTitle>
            <DialogDescription>
              Selecciona {isBuyer ? 'el vehículo que le interesa' : 'el cliente interesado'}. Se
              guardará en ambas fichas como interés, sin reservar ni registrar una venta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <label className="relative block">
              <span className="sr-only">{isBuyer ? 'Buscar vehículo' : 'Buscar comprador'}</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                maxLength={100}
                disabled={pending}
                placeholder={
                  isBuyer
                    ? 'Buscar por matrícula, marca o modelo'
                    : 'Buscar por nombre del comprador'
                }
                className="h-10 w-full rounded-lg border border-border bg-muted/30 pl-9 pr-3 text-[13px] outline-none focus:border-sidebar-primary focus:ring-2 focus:ring-sidebar-primary/15"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                  setSelected(null)
                  setError('')
                }}
              />
            </label>
            <div
              aria-label="Resultados de búsqueda"
              className="max-h-[32dvh] min-h-[120px] space-y-2 overflow-y-auto"
            >
              {loading ? (
                <p
                  role="status"
                  className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </p>
              ) : searchError ? (
                <div className="rounded-lg bg-red-50 p-4">
                  <p role="alert" className="text-[13px] text-red-700">
                    {searchError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRetry(retry + 1)}
                    className="mt-2 text-[12px] font-semibold underline"
                  >
                    Reintentar búsqueda
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center">
                  <Icon className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                  <p className="text-[13px] font-medium">Sin resultados</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {query
                      ? 'Prueba con otro nombre o matrícula.'
                      : 'No hay fichas disponibles para asociar.'}
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={pending || item.associated}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => {
                      setSelected(item)
                      setError('')
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${selected?.id === item.id ? 'border-sidebar-primary bg-sidebar-primary/5 ring-1 ring-sidebar-primary' : 'border-border hover:border-sidebar-primary/50 hover:bg-muted/40'}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-sidebar-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold" title={item.label}>
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {item.detail}
                      </span>
                      {item.associated && (
                        <span className="block text-[11px] font-medium text-sidebar-primary">
                          Ya asociado manualmente
                        </span>
                      )}
                    </span>
                    {selected?.id === item.id && (
                      <Check className="h-4 w-4 shrink-0 text-sidebar-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
            {!loading && !searchError && (page > 0 || hasMore) && (
              <div className="flex items-center justify-between text-[12px]">
                <button
                  type="button"
                  disabled={page === 0 || pending}
                  onClick={() => {
                    setPage(page - 1)
                    setSelected(null)
                  }}
                  className="flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span className="text-muted-foreground">Página {page + 1}</span>
                <button
                  type="button"
                  disabled={!hasMore || pending}
                  onClick={() => {
                    setPage(page + 1)
                    setSelected(null)
                  }}
                  className="flex items-center gap-1 disabled:opacity-40"
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {selected && (
              <div className="rounded-lg bg-sidebar-primary/5 p-3 text-[12px]">
                <span className="text-muted-foreground">Vas a asociar:</span>
                <p className="mt-1 font-semibold">{selected.label}</p>
                <p className="text-muted-foreground">{selected.detail}</p>
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => changeOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!selected || pending || loading || !!searchError}
                className="gap-2 bg-sidebar-primary text-white hover:bg-sidebar-primary/90"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? 'Guardando…' : action}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
